"""Adapter qui (gestore multi-istanza per qBittorrent, getqui.com) —
docs/SPEC.md sezione 15.

Verificato contro lo swagger/OpenAPI reale del progetto (github.com/autobrr/qui,
internal/web/swagger/openapi.yaml), non solo dedotto — smentisce l'assunzione
pragmatica originale (vedi ancora qbittorrent.py in questo pacchetto):
- Auth: header `X-API-Key`, MAI username/password — un'unica chiave copre
  tutte le istanze qBittorrent gestite da un deployment qui.
- Un deployment qui espone più istanze dietro `GET /api/instances`; ogni
  altra chiamata vive sotto `/api/instances/{instanceID}/...` — qui NON è
  la WebUI API nativa di qBittorrent pointed elsewhere, ha una propria API
  di aggregazione con nomi di campo/percorsi diversi (es. `savepath` in
  ingresso, `savePath` in uscita).
- `POST /api/instances/{id}/torrents` (multipart: `torrent` binario oppure
  `urls`) risponde 201 senza corpo — nessun info_hash restituito, stesso
  problema già risolto in qbittorrent.py con un diff prima/dopo sulla lista.
  L'endpoint dichiara SOLO multipart/form-data (mai form url-encoded): anche
  i campi testuali (`savepath`, `skip_checking`) vanno quindi passati come
  parti multipart con filename=None, non in un `data=` separato — altrimenti
  httpx non usa multipart quando non c'è nessun file reale da allegare
  (caso "urls"), violando il content-type che il server si aspetta.
- Nessun endpoint per leggere UN SOLO torrent per hash (confermato anche dal
  codice equivalente di Auditorr, sources/_qui.py, che scansiona sempre la
  lista paginata) — get_torrent_status() fa quindi una scansione paginata
  completa ad ogni chiamata, non solo per il nuovo hash dopo un add.
- Il recheck forzato passa da `POST /torrents/bulk-action` con
  `action: "recheck"` (SPEC.md sezione 8, mai skip_checking=True).

Un deployment qui gestisce più istanze qBittorrent dietro un solo host+api
token: un TorrentClient di gauntletarr punta sempre a UNA istanza specifica
(TorrentClient.qui_instance_id) — add_torrent deve sapere esattamente dove
scrivere, non può sceglierla a runtime.
"""

import os
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


class QuiTorrentClientAdapter(TorrentClientAdapter):
    def __init__(
        self,
        base_url: str,
        api_token: str,
        instance_id: int,
        http_client=None,
        poll_interval: float = 0.5,
        poll_timeout: float = 15.0,
        page_limit: int = 2000,
    ):
        self.base_url = base_url.rstrip("/")
        self.instance_id = instance_id
        self.poll_interval = poll_interval
        self.poll_timeout = poll_timeout
        self.page_limit = page_limit
        if http_client is not None:
            self._client = http_client
        else:
            import httpx

            self._client = httpx.Client(
                base_url=self.base_url, headers={"X-API-Key": api_token}, timeout=30.0
            )

    def add_torrent(self, torrent_file_or_url: str, save_path: str, force_recheck: bool = True) -> str:
        if not force_recheck:
            raise ValueError(
                "force_recheck=False non è permesso: il recheck reale è "
                "un requisito funzionale, vedi docs/SPEC.md sezione 8."
            )

        before_hashes = {t["hash"] for t in self._fetch_all_torrents() if t.get("hash")}

        # L'endpoint dichiara multipart/form-data come unico content-type
        # accettato (nessun application/json né form url-encoded) — anche i
        # campi testuali passano quindi per `files=`, con filename=None,
        # lo stesso trucco httpx/requests per forzare multipart pure quando
        # non c'è alcun file reale da allegare (caso "urls").
        files: dict = {"savepath": (None, save_path), "skip_checking": (None, "false")}
        if os.path.isfile(torrent_file_or_url):
            with open(torrent_file_or_url, "rb") as f:
                torrent_bytes = f.read()
            files["torrent"] = ("torrent.torrent", torrent_bytes, "application/x-bittorrent")
        else:
            files["urls"] = (None, torrent_file_or_url)

        response = self._client.post(f"/api/instances/{self.instance_id}/torrents", files=files)
        response.raise_for_status()

        info_hash = self._wait_for_new_hash(before_hashes)
        self._bulk_action([info_hash], "recheck")
        return info_hash

    def _wait_for_new_hash(self, before_hashes: set[str]) -> str:
        deadline = time.monotonic() + self.poll_timeout
        while time.monotonic() < deadline:
            current_hashes = {t["hash"] for t in self._fetch_all_torrents() if t.get("hash")}
            new_hashes = current_hashes - before_hashes
            if new_hashes:
                return next(iter(new_hashes))
            time.sleep(self.poll_interval)
        raise TorrentAddTimeoutError(
            f"Nessun nuovo torrent rilevato sull'istanza qui {self.instance_id} "
            f"entro {self.poll_timeout}s dall'aggiunta"
        )

    def _bulk_action(self, hashes: list[str], action: str) -> None:
        response = self._client.post(
            f"/api/instances/{self.instance_id}/torrents/bulk-action",
            json={"hashes": hashes, "action": action},
        )
        response.raise_for_status()

    def get_torrent_status(self, info_hash: str) -> TorrentStatus:
        torrent = next((t for t in self._fetch_all_torrents() if t.get("hash") == info_hash), None)
        if torrent is None:
            raise ValueError(f"Torrent {info_hash} non trovato sull'istanza qui {self.instance_id}")

        state = torrent.get("state") or ""
        progress = float(torrent.get("progress") or 0.0)
        if state in CHECKING_STATES:
            recheck_status = "pending"
        elif state in ERROR_STATES:
            recheck_status = "failed"
        elif progress >= 1.0:
            recheck_status = "ok"
        else:
            recheck_status = "failed"

        return TorrentStatus(info_hash=torrent["hash"], state=state, recheck_status=recheck_status, progress=progress)

    def list_torrents(self) -> list[ClientTorrentInfo]:
        result = []
        for torrent in self._fetch_all_torrents():
            info_hash = torrent.get("hash")
            if not info_hash:
                continue
            files_resp = self._client.get(f"/api/instances/{self.instance_id}/torrents/{info_hash}/files")
            files_resp.raise_for_status()
            files = [
                ClientTorrentFileInfo(path_in_torrent=f.get("name", ""), size_bytes=f.get("size") or 0)
                for f in files_resp.json()
            ]
            result.append(
                ClientTorrentInfo(
                    info_hash=info_hash,
                    name=torrent.get("name", ""),
                    save_path=torrent.get("savePath") or "",
                    state=torrent.get("state") or "",
                    category=torrent.get("category") or None,
                    tracker_url=self._first_tracker_url(info_hash),
                    files=files,
                )
            )
        return result

    def _first_tracker_url(self, info_hash: str) -> str | None:
        response = self._client.get(f"/api/instances/{self.instance_id}/torrents/{info_hash}/trackers")
        response.raise_for_status()
        for entry in response.json():
            url = entry.get("url") or ""
            if url.startswith("http") or url.startswith("udp"):
                return url
        return None

    def _fetch_all_torrents(self) -> list[dict]:
        """Scarica tutta la lista paginata (0-indexed, max 2000/pagina) —
        deduplicata per hash per restare robusta a un'API che ignorasse
        l'offset e ripetesse la stessa pagina, stesso approccio verificato
        nell'adapter equivalente di Auditorr."""
        all_torrents: list[dict] = []
        seen_hashes: set[str] = set()
        page = 0
        while True:
            response = self._client.get(
                f"/api/instances/{self.instance_id}/torrents",
                params={"page": page, "limit": self.page_limit},
            )
            response.raise_for_status()
            batch = response.json().get("torrents") or []
            if not batch:
                break
            new_items = [t for t in batch if t.get("hash") and t["hash"] not in seen_hashes]
            seen_hashes.update(t["hash"] for t in new_items)
            all_torrents.extend(new_items)
            if len(batch) < self.page_limit or not new_items:
                break
            page += 1
        return all_torrents
