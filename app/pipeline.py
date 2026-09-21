"""Orchestrazione di una run: scan filesystem (app/scanner.py) poi
indicizzazione client torrent (app/torrent_indexer.py), sempre in questo
ordine — l'indexer collega client_torrent_file ai seed_file appena
scritti dallo scan; nell'ordine inverso non troverebbe nulla a cui
collegarsi e ogni file risulterebbe erroneamente orphan_torrent invece
che seeding/ignored.

Import massivo e run schedulato (Fase 5) condivideranno questo stesso
motore — la differenza è solo nel trigger, non nella pipeline.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app import adapter_factory, scanner, torrent_indexer
from app.models import Disk, RunLog, TorrentClient

logger = logging.getLogger(__name__)


def start_run(session: Session, run_type: str) -> RunLog:
    run = RunLog(run_type=run_type, started_at=datetime.now(UTC), current_phase="scanning")
    session.add(run)
    session.commit()
    return run


def run_bulk_import(session: Session, run: RunLog) -> RunLog:
    """Import massivo: scansiona tutti i dischi configurati, poi indicizza
    tutti i client torrent abilitati (docs/SPEC.md sezione 11).

    Riceve `run` già creata (invece di crearla qui) perché l'API che lo
    innesca (app/api/runs.py) deve poter rispondere subito con l'id della
    run mentre il lavoro vero, potenzialmente lungo, prosegue in
    background con una sessione propria — se questa funzione creasse una
    seconda RunLog al posto di riusare quella, l'endpoint e la run
    finirebbero per riferirsi a due righe diverse."""
    totals = {"media_files_scanned": 0, "seed_files_scanned": 0, "torrents_indexed": 0, "files_indexed": 0}
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
    finally:
        run.current_phase = None
        run.finished_at = datetime.now(UTC)
        run.items_scanned = totals["media_files_scanned"] + totals["seed_files_scanned"]
        run.errors = errors
        session.commit()
    return run
