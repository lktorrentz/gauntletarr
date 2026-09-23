"""Rilevamento duplicati: stesso contenuto, inode diversi — distinto dalla
verifica hardlink già esistente (st_dev+inode, usata per collegare
seed_file a media_file). Qui si cercano copie NON intenzionali dello
stesso contenuto in punti diversi della libreria media, che sprecano
spazio su disco senza che nessun hardlink le colleghi.

Fingerprint: MD5 dei primi e ultimi 64KB del file (l'intero file se più
piccolo di 128KB), non un hash crittografico del contenuto completo — un
compromesso deliberato: leggere per intero ogni video di una libreria
reale ad ogni scan sarebbe troppo costoso. Una collisione accidentale tra
due file di dimensione diversa e stesso fast-hash è già esclusa a monte
raggruppando anche per size_bytes. Stesso approccio (fast partial hash)
verificato nell'equivalente di Auditorr (get_fast_hash).
"""

import hashlib
import os

from sqlalchemy.orm import Session

from app.file_types import is_video
from app.models import MediaFile

_CHUNK_SIZE = 64 * 1024


def compute_fast_hash(path: str) -> str | None:
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            head = f.read(_CHUNK_SIZE)
            tail = b""
            if size > _CHUNK_SIZE:
                f.seek(max(size - _CHUNK_SIZE, 0))
                tail = f.read(_CHUNK_SIZE)
        return hashlib.md5(head + tail).hexdigest()
    except OSError:
        return None


def find_duplicate_media_files(session: Session, disk_id: int | None = None) -> list[dict]:
    """Gruppi di media_file con stesso (size_bytes, content_hash) ma
    (st_dev, inode) diversi tra loro — file già hardlinkati fra loro
    condividono lo stesso inode e non contano come duplicati (nessuno
    spazio sprecato), quindi vengono esclusi qui, non solo dal fast-hash."""
    query = session.query(MediaFile).filter(MediaFile.content_hash.isnot(None))
    if disk_id is not None:
        query = query.filter_by(disk_id=disk_id)

    groups: dict[tuple[int, str], list[MediaFile]] = {}
    for mf in query.all():
        if not is_video(mf.relative_path):
            continue  # copie di nfo/immagini: rumore, nessuno spazio rilevante sprecato
        groups.setdefault((mf.size_bytes, mf.content_hash), []).append(mf)

    result = []
    for (size_bytes, content_hash), files in groups.items():
        distinct_inodes = {(mf.st_dev, mf.inode) for mf in files}
        if len(distinct_inodes) < 2:
            continue
        result.append({
            "content_hash": content_hash,
            "size_bytes": size_bytes,
            "files": [
                {"media_file_id": mf.id, "disk_id": mf.disk_id, "relative_path": mf.relative_path}
                for mf in sorted(files, key=lambda f: f.relative_path)
            ],
        })
    return sorted(result, key=lambda g: g["size_bytes"], reverse=True)
