"""Stato unificato per file (docs/SPEC.md sezione 3).

Fase 2: con client_torrent_file disponibile, si può finalmente distinguere
`orphan_torrent` (nessun client traccia il file) da `ignored` (un client lo
traccia ma non è collegato alla libreria media) — in Fase 1 erano
indistinguibili, un solo stato grezzo "nessun media_file collegato".

Definizione usata qui (coerente con la tabella di SPEC.md sezione 3):
- seeding: hardlink valido (seed_file.media_file_id impostato) E tracciato
  da almeno un client (>=1 client_torrent_file collegato)
- ignored: tracciato da un client, ma NESSUN hardlink verso la libreria
- orphan_torrent: NON tracciato da alcun client, indipendentemente
  dall'hardlink — un file già hardlinkato ma perso dal client rientra
  comunque qui, perché l'azione utile resta la stessa (aggiungerlo di
  nuovo al client, mai ricreare un hardlink che esiste già, sezione 3)
- orphan_media: media_file senza alcun seed_file sibling "seeding" (vedi sopra)
"""

from sqlalchemy.orm import Session

from app.models import ClientTorrentFile, MediaFile, SeedFile


def media_file_states(session: Session, disk_id: int | None = None) -> list[dict]:
    query = session.query(MediaFile)
    if disk_id is not None:
        query = query.filter_by(disk_id=disk_id)

    tracked_seed_file_ids = {
        row[0] for row in session.query(ClientTorrentFile.seed_file_id).filter(
            ClientTorrentFile.seed_file_id.isnot(None)
        ).all()
    }
    seeding_media_file_ids = {
        row[0]
        for row in session.query(SeedFile.media_file_id)
        .filter(SeedFile.media_file_id.isnot(None), SeedFile.id.in_(tracked_seed_file_ids))
        .all()
    } if tracked_seed_file_ids else set()

    return [
        {
            "id": mf.id,
            "disk_id": mf.disk_id,
            "relative_path": mf.relative_path,
            "size_bytes": mf.size_bytes,
            "state": "seeding" if mf.id in seeding_media_file_ids else "orphan_media",
        }
        for mf in query.order_by(MediaFile.relative_path).all()
    ]


def seed_file_states(session: Session, disk_id: int | None = None) -> list[dict]:
    query = session.query(SeedFile)
    if disk_id is not None:
        query = query.filter_by(disk_id=disk_id)

    tracked_seed_file_ids = {
        row[0] for row in session.query(ClientTorrentFile.seed_file_id).filter(
            ClientTorrentFile.seed_file_id.isnot(None)
        ).all()
    }

    def _state(sf: SeedFile) -> str:
        if sf.id not in tracked_seed_file_ids:
            return "orphan_torrent"
        return "seeding" if sf.media_file_id is not None else "ignored"

    return [
        {
            "id": sf.id,
            "disk_id": sf.disk_id,
            "relative_path": sf.relative_path,
            "size_bytes": sf.size_bytes,
            "media_file_id": sf.media_file_id,
            "state": _state(sf),
        }
        for sf in query.order_by(SeedFile.relative_path).all()
    ]
