"""Costruisce le istanze concrete degli adapter a partire dalla
configurazione nel DB.

Vedi CLAUDE.md: solo i mount point vivono in config.yaml, tutto il resto
(tracker, client torrent, credenziali, soglie) vive nel DB ed è editabile
da UI senza restart.
"""

from sqlalchemy.orm import Session

from app import settings_repo
from app.adapters.media_resolver.base import MediaResolverAdapter
from app.adapters.media_resolver.filename_parser import FilenameParserResolver
from app.adapters.torrent_client.base import TorrentClientAdapter
from app.adapters.torrent_client.qbittorrent import QBittorrentAdapter
from app.models import TorrentClient
from app.tmdb_client import TMDBClient


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


class TmdbApiKeyMissingError(ValueError):
    pass


def build_media_resolver(session: Session) -> MediaResolverAdapter:
    tmdb_api_key = settings_repo.get_setting(session, "tmdb_api_key")
    if not tmdb_api_key:
        raise TmdbApiKeyMissingError("tmdb_api_key non configurata in app_settings (PUT /api/settings/tmdb_api_key)")
    return FilenameParserResolver(TMDBClient(api_key=tmdb_api_key))
