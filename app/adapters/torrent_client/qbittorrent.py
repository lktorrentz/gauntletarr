"""Adapter qBittorrent — prima implementazione concreta, via libreria
qbittorrent-api.

NON validato contro un'istanza qBittorrent reale (nessuna disponibile in
fase di sviluppo) — solo contro un client mockato nei test. Da verificare
prima di un uso reale, in particolare:
- la mappatura stato nativo -> RecheckStatus (CHECKING_STATES/ERROR_STATES)
- il campo `tracker` su torrents_info(): popolato solo se un tracker è
  correntemente raggiungibile/funzionante, può essere vuoto anche con
  tracker validi configurati — trattato quindi come best-effort, mai come
  fonte affidabile al 100% (qui usato solo per popolare
  client_torrent.tracker_url a scopo informativo, non per logica di match)
- il timing del polling in _wait_for_new_hash

torrents_add() non garantisce di ritornare l'info_hash su ogni versione
dell'API qBittorrent: per essere version-agnostic, l'hash viene ricavato
confrontando l'elenco dei torrent prima/dopo l'aggiunta (diff), mai
fidandosi del solo valore di ritorno di torrents_add() — stesso approccio
di ratio-guardian.

"qui" (gestore multi-istanza per qBittorrent, docs/SPEC.md sezione 15) NON
usa questo adapter: espone una propria API di aggregazione (auth via
X-API-Key, percorsi sotto /api/instances/{id}/...), diversa dalla WebUI API
nativa di qBittorrent che qbittorrent-api si aspetta — confermato contro il
suo swagger/OpenAPI reale, non solo dedotto. Vedi app/adapters/torrent_client/qui.py.
"""

import logging
import time

from app.adapters.torrent_client.base import (
    CHECKING_STATES,
    ERROR_STATES,
    ClientTorrentFileInfo,
    ClientTorrentInfo,
    TorrentAddTimeoutError,
    TorrentClientAdapter,
    TorrentStatus,
)

logger = logging.getLogger(__name__)


class QBittorrentAdapter(TorrentClientAdapter):
    def __init__(
        self,
        base_url: str,
        username: str | None,
        password: str | None,
        client=None,
        poll_interval: float = 0.5,
        poll_timeout: float = 15.0,
    ):
        self.base_url = base_url
        self.username = username
        self.password = password
        self.poll_interval = poll_interval
        self.poll_timeout = poll_timeout
        if client is not None:
            self._client = client
        else:
            import qbittorrentapi

            self._client = qbittorrentapi.Client(host=base_url, username=username, password=password)

    def add_torrent(self, torrent_file_or_url: str, save_path: str, force_recheck: bool = True) -> str:
        if not force_recheck:
            raise ValueError(
                "force_recheck=False non è permesso: il recheck reale è "
                "un requisito funzionale, vedi docs/SPEC.md sezione 8."
            )

        before_hashes = {t.hash for t in self._client.torrents_info()}
        self._client.torrents_add(
            urls=torrent_file_or_url,
            save_path=save_path,
            is_skip_checking=False,
            use_auto_torrent_management=False,
        )
        info_hash = self._wait_for_new_hash(before_hashes)
        self._client.torrents_recheck(torrent_hashes=info_hash)
        return info_hash

    def _wait_for_new_hash(self, before_hashes: set[str]) -> str:
        deadline = time.monotonic() + self.poll_timeout
        while time.monotonic() < deadline:
            current_hashes = {t.hash for t in self._client.torrents_info()}
            new_hashes = current_hashes - before_hashes
            if new_hashes:
                if len(new_hashes) > 1:
                    logger.warning("Più torrent nuovi rilevati dopo add_torrent: %s", new_hashes)
                return next(iter(new_hashes))
            time.sleep(self.poll_interval)
        raise TorrentAddTimeoutError(
            f"Nessun nuovo torrent rilevato in qBittorrent entro {self.poll_timeout}s dall'aggiunta"
        )

    def get_torrent_status(self, info_hash: str) -> TorrentStatus:
        results = self._client.torrents_info(torrent_hashes=info_hash)
        if not results:
            raise ValueError(f"Torrent {info_hash} non trovato nel client")
        torrent = results[0]
        state = torrent.state

        if state in CHECKING_STATES:
            recheck_status = "pending"
        elif state in ERROR_STATES:
            recheck_status = "failed"
        elif torrent.progress >= 1.0:
            recheck_status = "ok"
        else:
            # Dopo un recheck, dati incompleti significa che il file
            # hardlinkato non corrisponde a quanto atteso dal torrent.
            recheck_status = "failed"

        return TorrentStatus(
            info_hash=torrent.hash, state=state, recheck_status=recheck_status, progress=torrent.progress
        )

    def list_torrents(self) -> list[ClientTorrentInfo]:
        result = []
        for torrent in self._client.torrents_info():
            files = [
                ClientTorrentFileInfo(path_in_torrent=f.name, size_bytes=f.size)
                for f in self._client.torrents_files(torrent_hash=torrent.hash)
            ]
            result.append(
                ClientTorrentInfo(
                    info_hash=torrent.hash,
                    name=torrent.name,
                    save_path=torrent.save_path,
                    state=torrent.state,
                    category=getattr(torrent, "category", "") or None,
                    tracker_url=getattr(torrent, "tracker", "") or None,
                    files=files,
                )
            )
        return result
