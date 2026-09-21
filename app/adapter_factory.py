"""Costruisce le istanze concrete degli adapter a partire dalla
configurazione nel DB.

Vedi CLAUDE.md: solo i mount point vivono in config.yaml, tutto il resto
(tracker, client torrent, credenziali, soglie) vive nel DB ed è editabile
da UI senza restart.
"""

from app.adapters.torrent_client.base import TorrentClientAdapter
from app.adapters.torrent_client.qbittorrent import QBittorrentAdapter
from app.models import TorrentClient


def build_torrent_client_adapter(torrent_client: TorrentClient) -> TorrentClientAdapter:
    if torrent_client.adapter_type == "qbittorrent":
        return QBittorrentAdapter(
            base_url=torrent_client.base_url,
            username=torrent_client.username,
            password=torrent_client.password,
        )
    raise ValueError(
        f"adapter_type torrent_client non ancora implementato: {torrent_client.adapter_type!r} "
        "(deluge/transmission/rutorrent pianificati, vedi docs/ROADMAP.md Fase 2)"
    )
