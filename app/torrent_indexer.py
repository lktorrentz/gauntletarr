"""Indicizzazione dei torrent noti a un client (docs/SPEC.md sezione 5).

Per ogni TorrentClient abilitato, associato a uno o più Disk (tabella
ponte disk_torrent_client): interroga l'adapter (sola lettura,
list_torrents()) e popola client_torrent/client_torrent_file, risolvendo
client_torrent_file.seed_file_id per PATH contro seed_file.relative_path
del disco giusto — collegamento per path, non per inode (docs/SPEC.md
sezione 4: più stabile, comunque riverificato a ogni poll).

Un client può vedere il filesystem da una radice diversa dalla nostra
(container/mount diversi per lo stesso disco fisico): se impostato,
disk.torrent_client_root_path sostituisce disk.root_path SOLO per
interpretare i path che arrivano dal client. Il confronto resta sempre
puramente lessicale (os.path.normpath/relpath) — MAI os.path.realpath sui
path riportati dal client: potrebbero non esistere affatto in questo
filesystem/namespace (è esattamente il motivo per cui
torrent_client_root_path esiste), quindi risolverli come se fossero
percorsi nostri produrrebbe risultati arbitrari, non un errore esplicito.
"""

import logging
import os
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.adapters.torrent_client.base import ClientTorrentInfo, TorrentClientAdapter
from app.db_utils import bulk_upsert
from app.models import ClientTorrent, ClientTorrentFile, Disk, RunLog, SeedFile, TorrentClient

logger = logging.getLogger(__name__)


def _resolve_seed_file_id(
    client_abs_path: str, disks: list[Disk], seed_lookup_by_disk: dict[int, dict[str, int]]
) -> int | None:
    candidate = os.path.normpath(client_abs_path)
    for disk in disks:
        client_root = os.path.normpath(disk.torrent_client_root_path or disk.root_path)
        if candidate == client_root or candidate.startswith(client_root + os.sep):
            rel_path = os.path.relpath(candidate, client_root)
            seed_file_id = seed_lookup_by_disk.get(disk.id, {}).get(rel_path)
            if seed_file_id is not None:
                return seed_file_id
    return None


def index_torrent_client(
    session: Session, torrent_client: TorrentClient, adapter: TorrentClientAdapter, run: RunLog
) -> dict[str, int]:
    """Interroga l'adapter e popola client_torrent/client_torrent_file per
    QUESTO client, collegandoli ai seed_file dei dischi ad esso associati
    (disk_torrent_client). Un client senza dischi associati viene comunque
    indicizzato (client_torrent creati), ma nessun file risulterà collegato
    a un seed_file — non è un errore, solo una configurazione incompleta."""
    now = datetime.now(UTC)
    torrents: list[ClientTorrentInfo] = adapter.list_torrents()

    torrent_rows = [
        {
            "torrent_client_id": torrent_client.id,
            "info_hash": t.info_hash,
            "name": t.name,
            "save_path": t.save_path,
            "category": t.category,
            "tracker_url": t.tracker_url,
            "state": t.state,
            "last_polled_at": now,
        }
        for t in torrents
    ]
    bulk_upsert(
        session, ClientTorrent.__table__, torrent_rows,
        conflict_cols=["torrent_client_id", "info_hash"],
        update_cols=["name", "save_path", "category", "tracker_url", "state", "last_polled_at"],
    )
    session.commit()

    hash_to_id: dict[str, int] = dict(
        session.query(ClientTorrent.info_hash, ClientTorrent.id).filter_by(torrent_client_id=torrent_client.id).all()
    )

    disks = torrent_client.disks
    seed_lookup_by_disk: dict[int, dict[str, int]] = {
        disk.id: dict(session.query(SeedFile.relative_path, SeedFile.id).filter_by(disk_id=disk.id).all())
        for disk in disks
    }

    file_rows = []
    for t in torrents:
        client_torrent_id = hash_to_id[t.info_hash]
        for f in t.files:
            client_abs_path = os.path.join(t.save_path, f.path_in_torrent)
            file_rows.append({
                "client_torrent_id": client_torrent_id,
                "path_in_torrent": f.path_in_torrent,
                "size_bytes": f.size_bytes,
                "seed_file_id": _resolve_seed_file_id(client_abs_path, disks, seed_lookup_by_disk),
                "last_scan_id": run.id,
            })

    bulk_upsert(
        session, ClientTorrentFile.__table__, file_rows,
        conflict_cols=["client_torrent_id", "path_in_torrent"],
        update_cols=["size_bytes", "seed_file_id", "last_scan_id"],
    )
    session.commit()

    return {"torrents_indexed": len(torrent_rows), "files_indexed": len(file_rows)}
