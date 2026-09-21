"""Costruisce le istanze concrete degli adapter a partire dalla
configurazione nel DB.

Vedi CLAUDE.md: solo i mount point vivono in config.yaml, tutto il resto
(tracker, client torrent, credenziali, soglie) vive nel DB ed è editabile
da UI senza restart.
"""

from sqlalchemy.orm import Session

from app import settings_repo
from app.adapters.image_host.base import ImageHostAdapter
from app.adapters.image_host.chain import ImageHostChain
from app.adapters.image_host.imgbb import ImgbbAdapter
from app.adapters.image_host.imgbox import ImgboxAdapter
from app.adapters.image_host.ptpimg import PtpimgAdapter
from app.adapters.media_resolver.base import MediaResolverAdapter
from app.adapters.media_resolver.filename_parser import FilenameParserResolver
from app.adapters.torrent_client.base import TorrentClientAdapter
from app.adapters.torrent_client.qbittorrent import QBittorrentAdapter
from app.adapters.tracker.base import TrackerAdapter, Unit3dTrackerAdapter
from app.models import TorrentClient, Tracker
from app.tmdb_client import TMDBClient

DEFAULT_IMAGE_HOST_PRIORITY = ["ptpimg", "imgbox", "imgbb"]


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


def build_tracker_adapter(tracker: Tracker) -> TrackerAdapter:
    if tracker.adapter_type == "unit3d":
        return Unit3dTrackerAdapter(
            base_url=tracker.base_url,
            api_token=tracker.api_token,
            rate_limit_per_min=tracker.rate_limit_per_min or 30,
        )
    raise ValueError(f"adapter_type tracker non supportato: {tracker.adapter_type!r}")


class ImageHostConfigError(ValueError):
    pass


def _build_image_host_adapter(session: Session, key: str) -> ImageHostAdapter | None:
    """None = host valido ma non configurato (nessuna api_key impostata),
    saltato in silenzio dalla catena — non un errore finché almeno un
    host della priorità configurata resta utilizzabile."""
    if key == "ptpimg":
        api_key = settings_repo.get_setting(session, "image_host_ptpimg_api_key")
        return PtpimgAdapter(api_key=api_key) if api_key else None
    if key == "imgbb":
        api_key = settings_repo.get_setting(session, "image_host_imgbb_api_key")
        return ImgbbAdapter(api_key=api_key) if api_key else None
    if key == "imgbox":
        return ImgboxAdapter()  # nessuna api_key richiesta (upload anonimi)
    raise ImageHostConfigError(f"Host immagini sconosciuto in image_host_priority: {key!r}")


def build_image_host_chain(session: Session) -> ImageHostChain:
    """Ordine di priorità configurabile via app_settings.image_host_priority
    (CSV, es. 'ptpimg,imgbox,imgbb') — default docs/SPEC.md §9/§17: prova
    PTPImg, poi Imgbox, poi ImgBB. Un host senza api_key configurata viene
    saltato; se la catena risultante è vuota, errore esplicito invece di
    scoprirlo solo al primo upload fallito."""
    raw_priority = settings_repo.get_setting(session, "image_host_priority")
    priority = (
        [k.strip() for k in raw_priority.split(",") if k.strip()] if raw_priority else DEFAULT_IMAGE_HOST_PRIORITY
    )

    adapters = [a for a in (_build_image_host_adapter(session, key) for key in priority) if a is not None]
    if not adapters:
        raise ImageHostConfigError(
            "Nessun host immagini configurato: imposta almeno una api_key "
            "(image_host_ptpimg_api_key / image_host_imgbb_api_key) — Imgbox "
            "da solo non richiede api_key ma va incluso in image_host_priority"
        )
    return ImageHostChain(adapters)
