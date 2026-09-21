"""Scansione filesystem: popola media_file e seed_file, rileva gli hardlink.

Vedi docs/SPEC.md sezione 4 per il razionale completo. Punti chiave da
rispettare qui, non altrove:

- Il grouping per hardlink (st_dev, inode) va calcolato IN MEMORIA durante
  il walk, mai con un self-join SQL a runtime.
- seed_file.media_file_id va scritto SOLO da questo modulo, con un bulk
  upsert a fine scan — mai una query/update per singolo file.
- Le righe non riviste in questo scan (file spostato/cancellato) non
  vanno cancellate: restano con un last_scan_id vecchio, così una query
  sullo stato corrente (filtrata su last_scan_id = run corrente) le
  esclude naturalmente senza bisogno di un DELETE esplicito.

Condiviso da import massivo e run schedulato (docs/SPEC.md sezione 11,
Fase 5) — la differenza tra i due è solo nel trigger, non nel motore.
"""

import logging
import os
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models import Disk, MediaFile, RunLog, SeedFile

logger = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mkv", ".mp4", ".avi", ".m2ts", ".ts", ".wmv", ".mov"}


def _walk_files(abs_root: str):
    """Ogni file sotto abs_root, come (path assoluto, stat). Un errore di
    stat su un singolo file (permessi, file sparito durante il walk) viene
    loggato e saltato — non deve mai far fallire l'intero scan."""
    if not os.path.isdir(abs_root):
        logger.warning("Percorso non raggiungibile, salto: %s", abs_root)
        return
    for dirpath, _dirnames, filenames in os.walk(abs_root):
        for name in filenames:
            full_path = os.path.join(dirpath, name)
            try:
                yield full_path, os.stat(full_path)
            except OSError as exc:
                logger.warning("Impossibile leggere %r: %s", full_path, exc)


def _bulk_upsert(session: Session, table, rows: list[dict], conflict_cols: list[str], update_cols: list[str]) -> None:
    if not rows:
        return
    stmt = sqlite_insert(table).values(rows)
    update_dict = {col: getattr(stmt.excluded, col) for col in update_cols}
    stmt = stmt.on_conflict_do_update(index_elements=conflict_cols, set_=update_dict)
    session.execute(stmt)


def start_run(session: Session, run_type: str) -> RunLog:
    run = RunLog(run_type=run_type, started_at=datetime.now(UTC), current_phase="scanning")
    session.add(run)
    session.commit()
    return run


def scan_disk(session: Session, disk: Disk, run: RunLog) -> dict[str, int]:
    """Scansiona un disco: tutte le sue MediaPath abilitate (filtrate alle
    estensioni video) e, se configurata, la sua cartella torrent (ogni
    file, senza filtro — un client traccia anche sottotitoli/nfo/sample,
    servirà per il collegamento coi client_torrent_file dalla Fase 2)."""
    now = datetime.now(UTC)
    media_rows: list[dict] = []
    for media_path in [mp for mp in disk.media_paths if mp.enabled]:
        abs_root = os.path.join(disk.root_path, media_path.relative_path)
        for full_path, st in _walk_files(abs_root):
            if Path(full_path).suffix.lower() not in VIDEO_EXTENSIONS:
                continue
            media_rows.append({
                "media_path_id": media_path.id,
                "disk_id": disk.id,
                "relative_path": os.path.relpath(full_path, disk.root_path),
                "size_bytes": st.st_size,
                "st_dev": st.st_dev,
                "inode": st.st_ino,
                "nlink": st.st_nlink,
                "last_scan_id": run.id,
                "last_seen_at": now,
            })

    _bulk_upsert(
        session, MediaFile.__table__, media_rows,
        conflict_cols=["disk_id", "relative_path"],
        update_cols=["media_path_id", "size_bytes", "st_dev", "inode", "nlink", "last_scan_id", "last_seen_at"],
    )
    session.commit()

    # (st_dev, inode) -> media_file.id per QUESTO disco, per risolvere seed_file.media_file_id
    # sotto senza una query per riga. Se più media_file condividono lo stesso inode (raro:
    # hardlink duplicato dentro la libreria stessa), vince quello con id più basso — gli altri
    # restano comunque visibili interrogando media_file per (disk_id, st_dev, inode).
    inode_to_media_file_id: dict[tuple[int, int], int] = {}
    for media_file_id, st_dev, inode in (
        session.query(MediaFile.id, MediaFile.st_dev, MediaFile.inode)
        .filter_by(disk_id=disk.id)
        .order_by(MediaFile.id)
        .all()
    ):
        inode_to_media_file_id.setdefault((st_dev, inode), media_file_id)

    seed_rows: list[dict] = []
    if disk.torrents_rel_path:
        abs_root = os.path.join(disk.root_path, disk.torrents_rel_path)
        for full_path, st in _walk_files(abs_root):
            seed_rows.append({
                "disk_id": disk.id,
                "relative_path": os.path.relpath(full_path, disk.root_path),
                "size_bytes": st.st_size,
                "st_dev": st.st_dev,
                "inode": st.st_ino,
                "media_file_id": inode_to_media_file_id.get((st.st_dev, st.st_ino)),
                "last_scan_id": run.id,
                "last_seen_at": now,
            })

    _bulk_upsert(
        session, SeedFile.__table__, seed_rows,
        conflict_cols=["disk_id", "relative_path"],
        update_cols=["size_bytes", "st_dev", "inode", "media_file_id", "last_scan_id", "last_seen_at"],
    )
    session.commit()

    return {"media_files_scanned": len(media_rows), "seed_files_scanned": len(seed_rows)}


def run_bulk_import(session: Session, run: RunLog) -> RunLog:
    """Import massivo: scansiona tutti i dischi configurati (docs/SPEC.md
    sezione 11) sulla RunLog già creata da start_run(). Il run schedulato
    (Fase 5) userà lo stesso motore.

    Riceve `run` già creata (invece di crearla qui) perché l'API che lo
    innesca (app/api/runs.py) deve poter rispondere subito con l'id della
    run mentre lo scan vero, potenzialmente lungo, prosegue in background
    con una sessione propria — se questa funzione creasse una seconda
    RunLog al posto di riusare quella, l'endpoint e lo scan finirebbero
    per riferirsi a due righe diverse."""
    totals = {"media_files_scanned": 0, "seed_files_scanned": 0}
    errors = 0
    try:
        for disk in session.query(Disk).all():
            try:
                counts = scan_disk(session, disk, run)
            except Exception:
                logger.exception("Scan fallito per il disco %r", disk.label)
                errors += 1
                continue
            for key in totals:
                totals[key] += counts[key]
    finally:
        run.current_phase = None
        run.finished_at = datetime.now(UTC)
        run.items_scanned = totals["media_files_scanned"] + totals["seed_files_scanned"]
        run.errors = errors
        session.commit()
    return run
