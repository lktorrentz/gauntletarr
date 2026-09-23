"""Orchestrazione di una run: scan filesystem (app/scanner.py), poi
risoluzione TMDB (app/media_resolution.py), poi indicizzazione client
torrent (app/torrent_indexer.py), poi matching (app/matching.py) ed
esecuzione automatica delle review sopra soglia (app/review.py), infine
reconcile dei seed_job ancora in corso.

Ordine vincolante:
- scan prima di indicizzazione: l'indexer collega client_torrent_file ai
  seed_file appena scritti dallo scan (§4) — invertito, ogni file
  risulterebbe erroneamente orphan_torrent invece che seeding/ignored.
- indicizzazione prima di matching: orphan_media_files/
  orphan_seed_files_with_identity (§3) dipendono dallo stato client
  aggiornato per classificare correttamente cosa è davvero orfano.
- risoluzione TMDB non ha dipendenze rispetto a indicizzazione/matching
  sull'ordine relativo, ma deve comunque precedere il matching (serve
  media_item_id risolto per cercare sul tracker).

Import massivo e run schedulato (Fase 5) condivideranno questo stesso
motore — la differenza è solo nel trigger, non nella pipeline.

Ogni fase committa run.current_phase PRIMA di eseguirsi (non solo a
inizio/fine run, come faceva la prima versione) così un poller su
GET /api/runs vede un avanzamento vero, non "scanning" per l'intera
durata. Ogni eccezione di fase fa, via _record_failure: log completo
(logger.exception, finisce nel log file letto dalla tab Logs),
session.rollback() — senza, un'eccezione DB a metà transazione lascia
la sessione inutilizzabile per tutto il resto della run, incluso il
commit finale che salva errors/finished_at: la run resta agganciata per
sempre come "in corso", senza mai un errore visibile né una fine (bug
diagnosticato proprio su questa funzione, sintomo: "ha chiamato il
client torrent e poi più nulla") — poi un commit dedicato di
errors/last_error, così un fallimento successivo non perde anche
questo. Un try/except esterno a tutte le fasi resta comunque come rete
di sicurezza per qualunque cosa sfugga ai blocchi già protetti (es. una
query() di per sé fallita, non solo il lavoro di una singola fase)."""

import logging
import os
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app import adapter_factory, arr, health, matching, media_resolution, review, scanner, torrent_indexer
from app.adapter_factory import TmdbApiKeyMissingError
from app.models import Disk, RunLog, TorrentClient, Tracker

logger = logging.getLogger(__name__)


def start_run(session: Session, run_type: str) -> RunLog:
    run = RunLog(run_type=run_type, started_at=datetime.now(UTC), current_phase="scanning")
    session.add(run)
    session.commit()
    return run


def _set_phase(session: Session, run: RunLog, phase: str) -> None:
    run.current_phase = phase
    session.commit()
    logger.info("Run #%s: fase '%s'", run.id, phase)


def _record_failure(session: Session, run: RunLog, errors: int, label: str, exc: Exception) -> int:
    logger.exception("Run #%s: %s fallito", run.id, label)
    session.rollback()
    run.errors = errors + 1
    run.last_error = f"{label}: {exc}"
    session.commit()
    return errors + 1


def _plural(n: int, singular: str, plural: str) -> str:
    return singular if n == 1 else plural


def run_bulk_import(session: Session, run: RunLog, data_dir: str) -> RunLog:
    """Import massivo: scansiona tutti i dischi configurati, risolve i
    media_file non ancora identificati via TMDB, poi indicizza tutti i
    client torrent abilitati (docs/SPEC.md sezione 11).

    Riceve `run` già creata (invece di crearla qui) perché l'API che lo
    innesca (app/api/runs.py) deve poter rispondere subito con l'id della
    run mentre il lavoro vero, potenzialmente lungo, prosegue in
    background con una sessione propria — se questa funzione creasse una
    seconda RunLog al posto di riusare quella, l'endpoint e la run
    finirebbero per riferirsi a due righe diverse."""
    totals = {
        "media_files_scanned": 0, "seed_files_scanned": 0,
        "torrents_indexed": 0, "files_indexed": 0,
        "resolved": 0, "unresolved": 0,
        "candidates_found": 0, "auto_executed": 0,
    }
    errors = 0

    try:
        _set_phase(session, run, "scanning")
        disks = session.query(Disk).all()
        logger.info("Run #%s: %d %s da scansionare", run.id, len(disks), _plural(len(disks), "disco", "dischi"))
        for disk in disks:
            logger.debug("Run #%s: scansione disco %r (%s)", run.id, disk.label, disk.root_path)
            try:
                counts = scanner.scan_disk(session, disk, run)
            except Exception as exc:
                errors = _record_failure(session, run, errors, f"scan del disco {disk.label!r}", exc)
                continue
            logger.info(
                "Run #%s: disco %r scansionato — %d media file, %d seed file",
                run.id, disk.label, counts["media_files_scanned"], counts["seed_files_scanned"],
            )
            totals["media_files_scanned"] += counts["media_files_scanned"]
            totals["seed_files_scanned"] += counts["seed_files_scanned"]

        _set_phase(session, run, "resolving")
        # Radarr/Sonarr (opzionali) indicizzati una sola volta per run:
        # servono sia alla risoluzione (identità senza TMDB) sia al matching
        # (torrent d'origine dalla history, senza ricerca sul tracker).
        arr_index = None
        try:
            arr_index = arr.build_arr_index(session)
            if len(arr_index):
                logger.info(
                    "Run #%s: Radarr/Sonarr — %d file identificati, %d con torrent d'origine nella history",
                    run.id, arr_index.counts["identities"], arr_index.counts["grabs"],
                )
        except Exception as exc:
            errors = _record_failure(session, run, errors, "indicizzazione Radarr/Sonarr", exc)
        try:
            resolver = adapter_factory.build_media_resolver(session, arr_index)
        except TmdbApiKeyMissingError:
            # Non ancora configurata: la risoluzione è opzionale a questo punto
            # del progetto (Fase 3), mai un errore bloccante — vedi docs/SPEC.md
            # sezione 6, "mai assunto presente".
            logger.info("Run #%s: TMDB non configurata, salto la risoluzione", run.id)
            resolver = None
        if resolver is not None:
            try:
                posters_dir = os.path.join(data_dir, "posters")
                counts = media_resolution.resolve_unmatched_media_files(session, resolver, posters_dir)
                totals["resolved"] = counts["resolved"]
                totals["unresolved"] = counts["unresolved"]
                logger.info(
                    "Run #%s: risoluzione TMDB — %d risolti, %d non risolti",
                    run.id, counts["resolved"], counts["unresolved"],
                )
            except Exception as exc:
                errors = _record_failure(session, run, errors, "risoluzione TMDB", exc)

        _set_phase(session, run, "indexing")
        torrent_clients = session.query(TorrentClient).filter_by(enabled=True).all()
        logger.info(
            "Run #%s: %d client torrent abilitat%s da indicizzare",
            run.id, len(torrent_clients), _plural(len(torrent_clients), "o", "i"),
        )
        for torrent_client in torrent_clients:
            logger.debug(
                "Run #%s: indicizzazione client %r (%s, %s)",
                run.id, torrent_client.label, torrent_client.adapter_type, torrent_client.base_url,
            )
            try:
                adapter = adapter_factory.build_torrent_client_adapter(torrent_client)
                counts = torrent_indexer.index_torrent_client(session, torrent_client, adapter, run)
            except Exception as exc:
                errors = _record_failure(session, run, errors, f"client torrent {torrent_client.label!r}", exc)
                continue
            logger.info(
                "Run #%s: client %r indicizzato — %d torrent, %d file",
                run.id, torrent_client.label, counts["torrents_indexed"], counts["files_indexed"],
            )
            totals["torrents_indexed"] += counts["torrents_indexed"]
            totals["files_indexed"] += counts["files_indexed"]

        _set_phase(session, run, "matching")
        trackers = session.query(Tracker).filter_by(enabled=True).all()
        logger.info(
            "Run #%s: %d tracker abilitat%s per il matching",
            run.id, len(trackers), _plural(len(trackers), "o", "i"),
        )
        for tracker_row in trackers:
            logger.debug("Run #%s: matching contro tracker %r", run.id, tracker_row.label)
            try:
                tracker_adapter = adapter_factory.build_tracker_adapter(tracker_row)
                m2t = matching.run_media_to_torrent_matching(session, tracker_row, tracker_adapter, arr_index)
                # Già in rate limit: la seconda direzione peggiorerebbe solo il blocco.
                t2c = (
                    matching.run_torrent_to_client_matching(session, tracker_row, tracker_adapter, arr_index)
                    if not m2t["rate_limited"]
                    else None
                )
            except Exception as exc:
                errors = _record_failure(session, run, errors, f"tracker {tracker_row.label!r}", exc)
                continue
            parts = [m2t] + ([t2c] if t2c else [])
            candidates = sum(p["candidates"] for p in parts)
            searched = sum(p["files"] for p in parts)
            skipped = sum(p["skipped_fresh"] for p in parts)
            from_history = sum(p["from_history"] for p in parts)
            failed = sum(p["failed"] for p in parts)
            rate_limited = any(p["rate_limited"] for p in parts)
            logger.info(
                "Run #%s: tracker %r — %d file cercati (%d via history Radarr/Sonarr), "
                "%d già cercati di recente saltati, %d falliti, %d candidati trovati",
                run.id, tracker_row.label, searched, from_history, skipped, failed, candidates,
            )
            totals["candidates_found"] += candidates
            if rate_limited or failed:
                problem = (
                    "rate limit (429) persistente, matching interrotto: i file rimanenti al prossimo giro"
                    if rate_limited
                    else f"{failed} file non cercati per errore (dettagli nei log)"
                )
                errors += 1
                run.errors = errors
                run.last_error = f"tracker {tracker_row.label!r}: {problem}"
                session.commit()

        _set_phase(session, run, "executing")
        try:
            exec_counts = review.execute_auto_approved(session)
            totals["auto_executed"] = exec_counts["executed"]
            logger.info("Run #%s: %d review eseguite automaticamente", run.id, exec_counts["executed"])
        except Exception as exc:
            errors = _record_failure(session, run, errors, "esecuzione automatica delle review", exc)

        _set_phase(session, run, "reconciling")
        try:
            review.reconcile_pending_seed_jobs(session)
            logger.info("Run #%s: reconcile dei seed_job in corso completato", run.id)
        except Exception as exc:
            errors = _record_failure(session, run, errors, "reconcile dei seed_job in corso", exc)
    except Exception as exc:
        # Rete di sicurezza: qualunque cosa sfugga ai blocchi già protetti
        # sopra (es. una query() o un commit() di per sé fallito, non solo
        # il lavoro di una singola fase) non deve comunque lasciare la run
        # agganciata per sempre — vedi la nota in cima al modulo.
        logger.exception("Run #%s: errore inatteso durante l'esecuzione", run.id)
        session.rollback()
        errors += 1
        run.last_error = f"errore inatteso: {exc}"

    run.current_phase = None
    run.finished_at = datetime.now(UTC)
    run.items_scanned = totals["media_files_scanned"] + totals["seed_files_scanned"]
    run.matches_found = totals["candidates_found"]
    run.auto_executed = totals["auto_executed"]
    try:
        snapshot = health.compute_snapshot(session)
        run.pending_review = snapshot["pending_review"]
        run.orphan_torrent_count = snapshot["orphan_torrent_count"]
        run.ignored_count = snapshot["ignored_count"]
        run.health_snapshot = snapshot["health_pct"]
    except Exception as exc:
        errors = _record_failure(session, run, errors, "calcolo dello snapshot di salute", exc)
        run.pending_review = len(review.list_ready_for_review(session))
    run.errors = errors
    session.commit()
    logger.info(
        "Run #%s completata: %d item scansionati, %d match, %d auto-eseguiti, %d errori",
        run.id, run.items_scanned, run.matches_found, run.auto_executed, errors,
    )
    return run
