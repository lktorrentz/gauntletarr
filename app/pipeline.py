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
"""

import logging
import os
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app import adapter_factory, health, matching, media_resolution, review, scanner, torrent_indexer
from app.adapter_factory import TmdbApiKeyMissingError
from app.models import Disk, RunLog, TorrentClient, Tracker

logger = logging.getLogger(__name__)


def start_run(session: Session, run_type: str) -> RunLog:
    run = RunLog(run_type=run_type, started_at=datetime.now(UTC), current_phase="scanning")
    session.add(run)
    session.commit()
    return run


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
        for disk in session.query(Disk).all():
            try:
                counts = scanner.scan_disk(session, disk, run)
            except Exception:
                logger.exception("Scan fallito per il disco %r", disk.label)
                errors += 1
                continue
            totals["media_files_scanned"] += counts["media_files_scanned"]
            totals["seed_files_scanned"] += counts["seed_files_scanned"]

        try:
            resolver = adapter_factory.build_media_resolver(session)
        except TmdbApiKeyMissingError:
            # Non ancora configurata: la risoluzione è opzionale a questo punto
            # del progetto (Fase 3), mai un errore bloccante — vedi docs/SPEC.md
            # sezione 6, "mai assunto presente".
            resolver = None
        if resolver is not None:
            try:
                posters_dir = os.path.join(data_dir, "posters")
                counts = media_resolution.resolve_unmatched_media_files(session, resolver, posters_dir)
                totals["resolved"] = counts["resolved"]
                totals["unresolved"] = counts["unresolved"]
            except Exception:
                logger.exception("Risoluzione TMDB fallita")
                errors += 1

        for torrent_client in session.query(TorrentClient).filter_by(enabled=True).all():
            try:
                adapter = adapter_factory.build_torrent_client_adapter(torrent_client)
                counts = torrent_indexer.index_torrent_client(session, torrent_client, adapter, run)
            except Exception:
                logger.exception("Indicizzazione fallita per il client torrent %r", torrent_client.label)
                errors += 1
                continue
            totals["torrents_indexed"] += counts["torrents_indexed"]
            totals["files_indexed"] += counts["files_indexed"]

        for tracker_row in session.query(Tracker).filter_by(enabled=True).all():
            try:
                tracker_adapter = adapter_factory.build_tracker_adapter(tracker_row)
                m2t = matching.run_media_to_torrent_matching(session, tracker_row, tracker_adapter)
                t2c = matching.run_torrent_to_client_matching(session, tracker_row, tracker_adapter)
            except Exception:
                logger.exception("Matching fallito per il tracker %r", tracker_row.label)
                errors += 1
                continue
            totals["candidates_found"] += m2t["candidates"] + t2c["candidates"]

        try:
            exec_counts = review.execute_auto_approved(session)
            totals["auto_executed"] = exec_counts["executed"]
        except Exception:
            logger.exception("Esecuzione automatica delle review fallita")
            errors += 1

        try:
            review.reconcile_pending_seed_jobs(session)
        except Exception:
            logger.exception("Reconcile dei seed_job in corso fallito")
            errors += 1
    finally:
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
        except Exception:
            logger.exception("Calcolo dello snapshot di salute fallito")
            errors += 1
            run.pending_review = len(review.list_ready_for_review(session))
        run.errors = errors
        session.commit()
    return run
