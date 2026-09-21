"""Stato unificato per file (docs/SPEC.md sezione 3).

Fase 1: solo gli stati derivabili da filesystem/hardlink puro, come da
docs/ROADMAP.md. `orphan_torrent` qui è ancora uno stato GREZZO ("nessun
media_file collegato via hardlink") — non distingue ancora un file
davvero orfano (nessun client lo traccia) da uno "ignorato" (un client lo
traccia ma non è collegato alla libreria): quella distinzione richiede
l'informazione sui client torrent, che arriva in Fase 2.
"""

from sqlalchemy.orm import Session

from app.models import MediaFile, SeedFile


def media_file_states(session: Session, disk_id: int | None = None) -> list[dict]:
    query = session.query(MediaFile)
    if disk_id is not None:
        query = query.filter_by(disk_id=disk_id)

    linked_ids = {
        row[0]
        for row in session.query(SeedFile.media_file_id).filter(SeedFile.media_file_id.isnot(None)).all()
    }
    return [
        {
            "id": mf.id,
            "disk_id": mf.disk_id,
            "relative_path": mf.relative_path,
            "size_bytes": mf.size_bytes,
            "state": "seeding" if mf.id in linked_ids else "orphan_media",
        }
        for mf in query.order_by(MediaFile.relative_path).all()
    ]


def seed_file_states(session: Session, disk_id: int | None = None) -> list[dict]:
    query = session.query(SeedFile)
    if disk_id is not None:
        query = query.filter_by(disk_id=disk_id)

    return [
        {
            "id": sf.id,
            "disk_id": sf.disk_id,
            "relative_path": sf.relative_path,
            "size_bytes": sf.size_bytes,
            "media_file_id": sf.media_file_id,
            "state": "seeding" if sf.media_file_id is not None else "orphan_torrent",
        }
        for sf in query.order_by(SeedFile.relative_path).all()
    ]
