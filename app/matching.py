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

import httpx
from sqlalchemy.orm import Session

from app.adapters.tracker.base import TorrentCandidate, TrackerAdapter
from app.mediainfo_util import compute_unique_id
from app.models import Candidate, ClientTorrentFile, MediaFile, SeedFile, Tracker
from app.torrent_file import TorrentMetainfoError, compute_info_hash, parse_torrent_info
from app.torrent_pieces import verify_file_pieces

logger = logging.getLogger(__name__)

# Regole esplicite (docs/SPEC.md sezione 6), non un punteggio ML.
CONFIDENCE_PIECE_VERIFIED = 0.99
CONFIDENCE_SIZE_AND_MEDIAINFO_MATCH = 0.9
CONFIDENCE_SIZE_ONLY = 0.5
CONFIDENCE_NO_MATCH = 0.0

_torrent_http_client = httpx.Client(timeout=15.0)


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


def _verify_piece_hash(local_path: str, tc: TorrentCandidate) -> tuple[str | None, bool | None, int | None]:
    """Scarica il .torrent e verifica i piece hash del file locale (solo
    candidati a file singolo arrivano qui, vedi score_candidate). None su
    qualunque problema di rete/formato — mai un'eccezione che interrompe
    il matching dell'intero file."""
    if not tc.download_link:
        return None, None, None
    try:
        response = _torrent_http_client.get(tc.download_link)
        response.raise_for_status()
        parsed = parse_torrent_info(response.content)
        info_hash = compute_info_hash(response.content)
    except (httpx.HTTPError, TorrentMetainfoError):
        logger.warning("Download/parsing del .torrent fallito per la verifica piece-hash", exc_info=True)
        return None, None, None

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
            info_hash, piece_verified, piece_boundary_count = _verify_piece_hash(local_path, tc)
            if piece_verified is False:
                confidence, ambiguity_reason = CONFIDENCE_NO_MATCH, "piece_mismatch"
            elif piece_verified is True:
                confidence, ambiguity_reason = CONFIDENCE_PIECE_VERIFIED, None

        candidate = Candidate(
            media_item_id=media_item_id,
            tracker_id=tracker_row.id,
            torrent_id_remote=tc.torrent_id_remote,
            info_hash=info_hash or tc.info_hash,
            name=tc.name,
            size_bytes=tc.size_bytes,
            file_list_json=json.dumps(tc.file_list) if tc.file_list is not None else None,
            folder=tc.folder,
            download_link=tc.download_link,
            source="catalog_search",
            direction=direction,
            size_match=size_match,
            mediainfo_match=mediainfo_match,
            piece_verified=piece_verified,
            piece_boundary_count=piece_boundary_count,
            confidence=confidence,
            ambiguity_reason=ambiguity_reason,
        )
        session.add(candidate)
        persisted.append(candidate)
    session.commit()
    return persisted


def orphan_media_files(session: Session) -> list[MediaFile]:
    """media_file con identità risolta ma senza hardlink verso alcun
    seed_file (orphan_media, docs/SPEC.md sezione 3) — stessa logica di
    app/library.py::media_file_states, qui filtrata a quelli risolvibili."""
    linked_ids = {
        row[0] for row in session.query(SeedFile.media_file_id).filter(SeedFile.media_file_id.isnot(None)).all()
    }
    return [
        mf
        for mf in session.query(MediaFile).filter(MediaFile.media_item_id.isnot(None)).all()
        if mf.id not in linked_ids
    ]


def orphan_seed_files_with_identity(session: Session) -> list[SeedFile]:
    """seed_file non tracciato da alcun client (orphan_torrent) il cui
    media_file collegato ha già un'identità risolta (docs/SPEC.md sezione 3,
    direzione torrent->client).

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
        if sf.media_file is not None and sf.media_file.media_item_id is not None:
            result.append(sf)
    return result


def run_media_to_torrent_matching(
    session: Session, tracker_row: Tracker, tracker_adapter: TrackerAdapter
) -> dict[str, int]:
    totals = {"files": 0, "candidates": 0}
    for media_file in orphan_media_files(session):
        candidates = match_file(
            session,
            media_item_id=media_file.media_item_id,
            tmdb_id=media_file.media_item.tmdb_id,
            local_path=f"{media_file.disk.root_path}/{media_file.relative_path}",
            local_size=media_file.size_bytes,
            tracker_row=tracker_row,
            tracker_adapter=tracker_adapter,
            direction="media_to_torrent",
        )
        totals["files"] += 1
        totals["candidates"] += len(candidates)
        from app.review import create_review_for_media_file  # import qui: evita un ciclo review<->matching

        create_review_for_media_file(session, media_file, candidates)
    return totals


def run_torrent_to_client_matching(
    session: Session, tracker_row: Tracker, tracker_adapter: TrackerAdapter
) -> dict[str, int]:
    totals = {"files": 0, "candidates": 0}
    for seed_file in orphan_seed_files_with_identity(session):
        media_item = seed_file.media_file.media_item
        candidates = match_file(
            session,
            media_item_id=media_item.id,
            tmdb_id=media_item.tmdb_id,
            local_path=f"{seed_file.disk.root_path}/{seed_file.relative_path}",
            local_size=seed_file.size_bytes,
            tracker_row=tracker_row,
            tracker_adapter=tracker_adapter,
            direction="torrent_to_client",
        )
        totals["files"] += 1
        totals["candidates"] += len(candidates)
        from app.review import create_review_for_seed_file  # import qui: evita un ciclo review<->matching

        create_review_for_seed_file(session, seed_file, candidates)
    return totals
