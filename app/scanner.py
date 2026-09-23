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

L'orchestrazione di una run intera (questo scan + l'indicizzazione dei
client torrent di app/torrent_indexer.py, sempre in questo ordine) vive in
app/pipeline.py, non qui — questo modulo resta scoped al solo filesystem.
"""

import logging
import os
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db_utils import bulk_upsert
from app.duplicates import compute_fast_hash
from app.file_types import VIDEO_EXTENSIONS, is_video  # noqa: F401  (riesportati)
from app.models import Disk, MediaFile, RunLog, SeedFile

logger = logging.getLogger(__name__)


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


def scan_disk(session: Session, disk: Disk, run: RunLog) -> dict[str, int]:
    """Scansiona un disco: la sua cartella media e la sua cartella torrent,
    se configurate — ogni file su entrambi i lati, video e non. I file
    extra (nfo, sottotitoli, sample) servono per ricreare torrent che li
    contengono; nasconderli da viste e conteggi è compito delle esclusioni
    (app/exclusions.py), mai dello scanner."""
    now = datetime.now(UTC)
    media_rows: list[dict] = []
    if disk.media_rel_path:
        abs_root = os.path.join(disk.root_path, disk.media_rel_path)
        for full_path, st in _walk_files(abs_root):
            media_rows.append({
                "disk_id": disk.id,
                "relative_path": os.path.relpath(full_path, disk.root_path),
                "size_bytes": st.st_size,
                "st_dev": st.st_dev,
                "inode": st.st_ino,
                "nlink": st.st_nlink,
                # Costo limitato a 128KB/file indipendentemente dalla dimensione
                # (app/duplicates.py) — ricalcolato a ogni scan, nessuna cache
                # incrementale ancora: un'ottimizzazione futura, non bloccante.
                "content_hash": compute_fast_hash(full_path),
                "last_scan_id": run.id,
                "last_seen_at": now,
            })

    bulk_upsert(
        session, MediaFile.__table__, media_rows,
        conflict_cols=["disk_id", "relative_path"],
        update_cols=[
            "size_bytes", "st_dev", "inode", "nlink", "content_hash",
            "last_scan_id", "last_seen_at",
        ],
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

    bulk_upsert(
        session, SeedFile.__table__, seed_rows,
        conflict_cols=["disk_id", "relative_path"],
        update_cols=["size_bytes", "st_dev", "inode", "media_file_id", "last_scan_id", "last_seen_at"],
    )
    session.commit()

    return {"media_files_scanned": len(media_rows), "seed_files_scanned": len(seed_rows)}
