"""Motore di matching: per ogni file orfano (media_file o seed_file),
cerca candidati sul tracker e scrive righe `candidate` con confidence
esplicita e spiegabile (mai un punteggio ML opaco). Vedi docs/SPEC.md
sezioni 3, 6, 8.

Season pack (torrent con più di un file video) sono **fuori scope in
questa fase**: ricevono confidence 0.0 e ambiguity_reason=
"season_pack_not_supported", sempre instradati in revisione manuale, mai
auto-eseguiti — semplificazione esplicita rispetto a ratio-guardian (che
isola l'episodio cercato dentro il pack via guessit sui nomi dei file
del pack). Vedi docs/ROADMAP.md Fase 4 per il motivo di questa scelta.

Le due direzioni (docs/SPEC.md sezione 3) condividono lo stesso
`score_candidate`/verifica piece-hash, cambia solo quali file orfani si
iterano e quale soglia si applica poi in fase di revisione (app/review.py).
"""

import json
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app import settings_repo
from app.adapters.tracker.base import (
    NotSupportedError,
    TorrentCandidate,
    TrackerAdapter,
    TrackerRateLimitedError,
    UploadError,
)
from app.arr import ArrGrab, ArrIndex, host_of
from app.exclusions import CompiledExclusions, load_exclusions
from app.mediainfo_util import compute_unique_id
from app.models import Candidate, ClientTorrentFile, MatchAttempt, MediaFile, SeedFile, Tracker
from app.torrent_file import TorrentInfo, TorrentMetainfoError, compute_info_hash, parse_torrent_info
from app.torrent_pieces import verify_file_pieces

logger = logging.getLogger(__name__)

# Regole esplicite (docs/SPEC.md sezione 6), non un punteggio ML.
CONFIDENCE_PIECE_VERIFIED = 0.99
CONFIDENCE_SIZE_AND_MEDIAINFO_MATCH = 0.9
CONFIDENCE_SIZE_ONLY = 0.5
CONFIDENCE_NO_MATCH = 0.0

# Ogni quanto un file orfano già cercato su un tracker viene ricercato
# comunque, anche se nulla è cambiato (nuovi upload sul tracker). Setting
# app_settings "rematch_interval_days", 0 = ricerca a ogni run come prima.
DEFAULT_REMATCH_INTERVAL_DAYS = 7


def _is_single_file_candidate(tc: TorrentCandidate) -> bool:
    files = tc.file_list or []
    return len(files) <= 1


def score_candidate(
    local_path: str, local_size: int, tc: TorrentCandidate
) -> tuple[float, bool | None, bool | None, str | None]:
    """(confidence, size_match, mediainfo_match, ambiguity_reason). Non
    calcola piece_verified qui — richiede un fetch di rete, fatto solo se
    conviene davvero (vedi match_file)."""
    if not _is_single_file_candidate(tc):
        return CONFIDENCE_NO_MATCH, None, None, "season_pack_not_supported"

    size_match = tc.size_bytes == local_size
    if not size_match:
        return CONFIDENCE_NO_MATCH, False, None, None

    mediainfo_match = None
    if tc.mediainfo_unique_id is not None:
        local_unique_id = compute_unique_id(local_path)
        if local_unique_id is not None:
            mediainfo_match = local_unique_id == tc.mediainfo_unique_id

    if mediainfo_match is False:
        # dimensione combacia ma il contenuto reale no: falso positivo,
        # non un candidato debole da mandare comunque in review.
        return CONFIDENCE_NO_MATCH, True, False, "mediainfo_mismatch"
    if mediainfo_match is True:
        return CONFIDENCE_SIZE_AND_MEDIAINFO_MATCH, True, True, None
    return CONFIDENCE_SIZE_ONLY, True, None, None


def _verify_piece_hash(
    local_path: str, tc: TorrentCandidate, tracker_adapter: TrackerAdapter
) -> tuple[str | None, bool | None, int | None]:
    """Scarica il .torrent (tramite l'adapter, così passa dal rate limiting
    del tracker) e verifica i piece hash del file locale (solo candidati a
    file singolo arrivano qui, vedi score_candidate). None su qualunque
    problema di rete/formato — mai un'eccezione che interrompe il matching
    dell'intero file. Unica eccezione: TrackerRateLimitedError risale,
    perché significa smettere di interrogare questo tracker del tutto."""
    if not tc.download_link:
        return None, None, None
    try:
        content = tracker_adapter.download_torrent(tc.download_link)
        parsed = parse_torrent_info(content)
        info_hash = compute_info_hash(content)
    except TrackerRateLimitedError:
        raise
    except (UploadError, NotSupportedError, TorrentMetainfoError):
        logger.warning("Download/parsing del .torrent fallito per la verifica piece-hash", exc_info=True)
        return None, None, None

    return _verify_pieces_from_torrent(local_path, parsed, info_hash)


def _verify_pieces_from_torrent(
    local_path: str, parsed: TorrentInfo, info_hash: str
) -> tuple[str | None, bool | None, int | None]:
    if len(parsed.files) != 1:
        return info_hash, None, None
    entry = parsed.files[0]
    result = verify_file_pieces(
        local_path, parsed.piece_length, parsed.pieces, parsed.total_length, entry.offset, entry.length
    )
    if result.mismatches > 0:
        return info_hash, False, result.boundary
    if result.clean:
        return info_hash, True, result.boundary
    return info_hash, None, result.boundary


def match_file(
    session: Session,
    media_item_id: int,
    tmdb_id: int,
    local_path: str,
    local_size: int,
    tracker_row: Tracker,
    tracker_adapter: TrackerAdapter,
    direction: str,
) -> list[Candidate]:
    """Cerca sul tracker per tmdb_id e valuta ogni candidato contro un solo
    file locale (mai season-pack-aware, vedi sopra). Persiste tutte le
    righe candidate anche a confidence 0 (audit trail), un solo commit per
    chiamata."""
    torrent_candidates = tracker_adapter.search_by_tmdb(tmdb_id)
    persisted = []
    for tc in torrent_candidates:
        confidence, size_match, mediainfo_match, ambiguity_reason = score_candidate(local_path, local_size, tc)

        piece_verified = None
        piece_boundary_count = None
        info_hash = None
        # Solo per i candidati ambigui (size ok, mediainfo non conclusivo)
        # vale la spesa di un fetch di rete + rilettura del file — mai per
        # ogni candidato di ogni file.
        if confidence == CONFIDENCE_SIZE_ONLY:
            info_hash, piece_verified, piece_boundary_count = _verify_piece_hash(local_path, tc, tracker_adapter)
            if piece_verified is False:
                confidence, ambiguity_reason = CONFIDENCE_NO_MATCH, "piece_mismatch"
            elif piece_verified is True:
                confidence, ambiguity_reason = CONFIDENCE_PIECE_VERIFIED, None

        persisted.append(_candidate_row(
            tc, media_item_id=media_item_id, tracker_row=tracker_row, direction=direction,
            source="catalog_search", info_hash=info_hash or tc.info_hash, size_match=size_match,
            mediainfo_match=mediainfo_match, piece_verified=piece_verified,
            piece_boundary_count=piece_boundary_count, confidence=confidence, ambiguity_reason=ambiguity_reason,
        ))
    session.add_all(persisted)
    session.commit()
    return persisted


def _candidate_row(tc: TorrentCandidate, *, media_item_id: int, tracker_row: Tracker, direction: str,
                   source: str, **scores) -> Candidate:
    return Candidate(
        media_item_id=media_item_id,
        tracker_id=tracker_row.id,
        torrent_id_remote=tc.torrent_id_remote,
        name=tc.name,
        size_bytes=tc.size_bytes,
        file_list_json=json.dumps(tc.file_list) if tc.file_list is not None else None,
        folder=tc.folder,
        download_link=tc.download_link,
        source=source,
        direction=direction,
        **scores,
    )


def match_from_history(
    session: Session,
    media_item_id: int,
    local_path: str,
    local_size: int,
    grab: ArrGrab,
    tracker_row: Tracker,
    tracker_adapter: TrackerAdapter,
    direction: str,
) -> list[Candidate]:
    """Candidato unico dal torrent che Radarr/Sonarr ricordano per questo
    file (app/arr.py): un solo download del .torrent al posto della ricerca
    sul catalogo più i download dei candidati ambigui. Stesse regole di
    confidence esplicite di match_file (size, poi piece hash sul .torrent
    già scaricato) — la provenienza dalla history non alza da sola la
    confidence: un file può essere stato sostituito dopo l'import, sono i
    piece hash a dirlo. Lista vuota se il .torrent non è scaricabile o
    leggibile: il chiamante ripiega sulla ricerca normale."""
    try:
        content = tracker_adapter.download_torrent(grab.download_url)
        parsed = parse_torrent_info(content)
        info_hash = compute_info_hash(content)
    except TrackerRateLimitedError:
        raise
    except (UploadError, NotSupportedError, TorrentMetainfoError):
        logger.warning("Download del .torrent dalla history fallito, ripiego sulla ricerca", exc_info=True)
        return []

    if parsed.is_multi_file:
        folder, file_list = parsed.name, [f.path for f in parsed.files]
    else:
        folder, file_list = None, [parsed.name]
    tc = TorrentCandidate(
        torrent_id_remote=grab.torrent_id_remote, info_hash=info_hash, name=parsed.name,
        size_bytes=parsed.total_length, file_list=file_list, mediainfo_unique_id=None,
        folder=folder, download_link=grab.download_url,
        file_sizes={f.path: f.length for f in parsed.files},
    )
    confidence, size_match, mediainfo_match, ambiguity_reason = score_candidate(local_path, local_size, tc)
    piece_verified = piece_boundary_count = None
    if confidence == CONFIDENCE_SIZE_ONLY:
        _, piece_verified, piece_boundary_count = _verify_pieces_from_torrent(local_path, parsed, info_hash)
        if piece_verified is False:
            confidence, ambiguity_reason = CONFIDENCE_NO_MATCH, "piece_mismatch"
        elif piece_verified is True:
            confidence, ambiguity_reason = CONFIDENCE_PIECE_VERIFIED, None

    candidate = _candidate_row(
        tc, media_item_id=media_item_id, tracker_row=tracker_row, direction=direction, source="history",
        info_hash=info_hash, size_match=size_match, mediainfo_match=mediainfo_match,
        piece_verified=piece_verified, piece_boundary_count=piece_boundary_count,
        confidence=confidence, ambiguity_reason=ambiguity_reason,
    )
    session.add(candidate)
    session.commit()
    return [candidate]


def _find_candidates(
    session: Session,
    *,
    media_item_id: int,
    tmdb_id: int,
    local_path: str,
    local_size: int,
    tracker_row: Tracker,
    tracker_adapter: TrackerAdapter,
    direction: str,
    arr_index: ArrIndex | None,
) -> tuple[list[Candidate], bool]:
    """(candidati, da_history). Prima la history di Radarr/Sonarr se ricorda
    un torrent di QUESTO tracker per il file; ricerca sul catalogo solo se
    non c'è o non ha dato un candidato plausibile."""
    grab = arr_index.grab_for(local_path, local_size) if arr_index is not None else None
    if grab is not None and grab.tracker_host == host_of(tracker_row.base_url):
        candidates = match_from_history(
            session, media_item_id, local_path, local_size, grab, tracker_row, tracker_adapter, direction
        )
        if any(c.confidence > CONFIDENCE_NO_MATCH for c in candidates):
            return candidates, True
    return match_file(
        session, media_item_id=media_item_id, tmdb_id=tmdb_id, local_path=local_path, local_size=local_size,
        tracker_row=tracker_row, tracker_adapter=tracker_adapter, direction=direction,
    ), False


def orphan_media_files(session: Session, exclusions: CompiledExclusions | None = None) -> list[MediaFile]:
    """media_file con identità risolta ma senza hardlink verso alcun
    seed_file (orphan_media, docs/SPEC.md sezione 3) — stessa logica di
    app/library.py::media_file_states, qui filtrata a quelli risolvibili e
    non esclusi (Configuration > Exclusions)."""
    linked_ids = {
        row[0] for row in session.query(SeedFile.media_file_id).filter(SeedFile.media_file_id.isnot(None)).all()
    }
    return [
        mf
        for mf in session.query(MediaFile).filter(MediaFile.media_item_id.isnot(None)).all()
        if mf.id not in linked_ids and not (exclusions and exclusions.is_excluded(mf.relative_path))
    ]


def orphan_seed_files_with_identity(
    session: Session, exclusions: CompiledExclusions | None = None
) -> list[SeedFile]:
    """seed_file non tracciato da alcun client (orphan_torrent) il cui
    media_file collegato ha già un'identità risolta (docs/SPEC.md sezione 3,
    direzione torrent->client), esclusi i file esclusi.

    Semplificazione esplicita di questa fase: un seed_file senza
    media_file_id (mai stato organizzato nella libreria, quindi mai
    passato dal resolver) non viene risolto qui — richiederebbe girare il
    resolver anche sul lato torrent, non ancora fatto (docs/ROADMAP.md
    Fase 4)."""
    tracked_ids = {
        row[0]
        for row in session.query(ClientTorrentFile.seed_file_id)
        .filter(ClientTorrentFile.seed_file_id.isnot(None))
        .all()
    }
    result = []
    for sf in session.query(SeedFile).filter(SeedFile.media_file_id.isnot(None)).all():
        if sf.id in tracked_ids:
            continue
        if exclusions and exclusions.is_excluded(sf.relative_path):
            continue
        if sf.media_file is not None and sf.media_file.media_item_id is not None:
            result.append(sf)
    return result


def get_rematch_interval(session: Session) -> timedelta:
    raw = settings_repo.get_setting(session, "rematch_interval_days")
    try:
        days = float(raw) if raw is not None else DEFAULT_REMATCH_INTERVAL_DAYS
    except ValueError:
        days = DEFAULT_REMATCH_INTERVAL_DAYS
    return timedelta(days=max(days, 0))


def _as_utc(value: datetime) -> datetime:
    # SQLite restituisce datetime naive anche se salvati aware.
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _attempt_for(
    session: Session, tracker_row: Tracker, *, media_file_id: int | None = None, seed_file_id: int | None = None
) -> MatchAttempt | None:
    query = session.query(MatchAttempt).filter_by(tracker_id=tracker_row.id)
    if media_file_id is not None:
        return query.filter_by(media_file_id=media_file_id).one_or_none()
    return query.filter_by(seed_file_id=seed_file_id).one_or_none()


def _is_fresh(attempt: MatchAttempt | None, size_bytes: int, tmdb_id: int, interval: timedelta) -> bool:
    """Un tentativo precedente vale ancora se il file e la sua identità non
    sono cambiati e non è passato rematch_interval_days — in quel caso i
    candidati e la review già salvati restano validi, nessuna nuova ricerca."""
    if attempt is None or interval <= timedelta(0):
        return False
    if attempt.size_bytes != size_bytes or attempt.tmdb_id != tmdb_id:
        return False
    return datetime.now(UTC) - _as_utc(attempt.attempted_at) < interval


def _record_attempt(
    session: Session,
    attempt: MatchAttempt | None,
    tracker_row: Tracker,
    size_bytes: int,
    tmdb_id: int,
    *,
    media_file_id: int | None = None,
    seed_file_id: int | None = None,
) -> None:
    if attempt is None:
        attempt = MatchAttempt(tracker_id=tracker_row.id, media_file_id=media_file_id, seed_file_id=seed_file_id)
        session.add(attempt)
    attempt.size_bytes = size_bytes
    attempt.tmdb_id = tmdb_id
    attempt.attempted_at = datetime.now(UTC)
    session.commit()


def _new_totals() -> dict:
    return {
        "files": 0, "from_history": 0, "candidates": 0, "skipped_fresh": 0, "failed": 0, "rate_limited": False,
    }


def run_media_to_torrent_matching(
    session: Session, tracker_row: Tracker, tracker_adapter: TrackerAdapter, arr_index: ArrIndex | None = None
) -> dict:
    """Un errore su un singolo file lo salta (loggato, contato in "failed")
    senza fermare gli altri; un TrackerRateLimitedError invece ferma il
    matching su questo tracker per il resto della run ("rate_limited"),
    lasciando i file rimanenti al prossimo giro — la ricerca di quelli
    completati è già registrata in match_attempt, quindi non si ripete."""
    from app.review import create_review_for_media_file  # import qui: evita un ciclo review<->matching

    totals = _new_totals()
    interval = get_rematch_interval(session)
    for media_file in orphan_media_files(session, load_exclusions(session)):
        tmdb_id = media_file.media_item.tmdb_id
        attempt = _attempt_for(session, tracker_row, media_file_id=media_file.id)
        if _is_fresh(attempt, media_file.size_bytes, tmdb_id, interval):
            totals["skipped_fresh"] += 1
            continue
        try:
            candidates, from_history = _find_candidates(
                session,
                media_item_id=media_file.media_item_id,
                tmdb_id=tmdb_id,
                local_path=f"{media_file.disk.root_path}/{media_file.relative_path}",
                local_size=media_file.size_bytes,
                tracker_row=tracker_row,
                tracker_adapter=tracker_adapter,
                direction="media_to_torrent",
                arr_index=arr_index,
            )
            create_review_for_media_file(session, media_file, candidates)
        except TrackerRateLimitedError:
            logger.warning("Tracker %r in rate limit: matching interrotto per questa run", tracker_row.label)
            session.rollback()
            totals["rate_limited"] = True
            break
        except Exception:
            logger.exception("Matching fallito per media_file %s su tracker %r", media_file.id, tracker_row.label)
            session.rollback()
            totals["failed"] += 1
            continue
        _record_attempt(
            session, attempt, tracker_row, media_file.size_bytes, tmdb_id, media_file_id=media_file.id
        )
        totals["files"] += 1
        totals["from_history"] += int(from_history)
        totals["candidates"] += len(candidates)
    return totals


def run_torrent_to_client_matching(
    session: Session, tracker_row: Tracker, tracker_adapter: TrackerAdapter, arr_index: ArrIndex | None = None
) -> dict:
    """Stesse regole di run_media_to_torrent_matching, direzione opposta."""
    from app.review import create_review_for_seed_file  # import qui: evita un ciclo review<->matching

    totals = _new_totals()
    interval = get_rematch_interval(session)
    for seed_file in orphan_seed_files_with_identity(session, load_exclusions(session)):
        media_item = seed_file.media_file.media_item
        attempt = _attempt_for(session, tracker_row, seed_file_id=seed_file.id)
        if _is_fresh(attempt, seed_file.size_bytes, media_item.tmdb_id, interval):
            totals["skipped_fresh"] += 1
            continue
        try:
            candidates, from_history = _find_candidates(
                session,
                media_item_id=media_item.id,
                tmdb_id=media_item.tmdb_id,
                local_path=f"{seed_file.disk.root_path}/{seed_file.relative_path}",
                local_size=seed_file.size_bytes,
                tracker_row=tracker_row,
                tracker_adapter=tracker_adapter,
                direction="torrent_to_client",
                arr_index=arr_index,
            )
            create_review_for_seed_file(session, seed_file, candidates)
        except TrackerRateLimitedError:
            logger.warning("Tracker %r in rate limit: matching interrotto per questa run", tracker_row.label)
            session.rollback()
            totals["rate_limited"] = True
            break
        except Exception:
            logger.exception("Matching fallito per seed_file %s su tracker %r", seed_file.id, tracker_row.label)
            session.rollback()
            totals["failed"] += 1
            continue
        _record_attempt(
            session, attempt, tracker_row, seed_file.size_bytes, media_item.tmdb_id, seed_file_id=seed_file.id
        )
        totals["files"] += 1
        totals["from_history"] += int(from_history)
        totals["candidates"] += len(candidates)
    return totals
