"""Contratto per gli adapter client torrent.

Vedi docs/SPEC.md sezione 5 e sezione 8 (ereditata da ratio-guardian per
add_torrent/get_torrent_status — il recheck forzato dopo l'aggiunta del
torrent è un requisito funzionale non negoziabile, mai un modo per
bypassarlo implicitamente, es. default a skip_checking=True).

list_torrents() è la parte nuova rispetto a ratio-guardian: enumera ogni
torrent noto al client, file per file, usata da app/torrent_indexer.py per
popolare client_torrent/client_torrent_file e quindi calcolare
orphan_torrent/ignored (sezione 3, multi-client). Sola lettura — non
aggiunge/modifica mai nulla sul client.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal

RecheckStatus = Literal["pending", "ok", "failed"]

# Stati nativi qBittorrent che indicano un controllo hash in corso.
CHECKING_STATES = {"checkingUP", "checkingDL", "checkingResumeData"}
# Stati nativi che indicano un fallimento esplicito (dati mancanti/corrotti).
ERROR_STATES = {"error", "missingFiles"}


@dataclass
class TorrentStatus:
    info_hash: str
    state: str  # stato nativo del client, non normalizzato
    recheck_status: RecheckStatus
    progress: float  # 0.0-1.0


@dataclass
class ClientTorrentFileInfo:
    path_in_torrent: str  # relativo alla save_path del torrent
    size_bytes: int


@dataclass
class ClientTorrentInfo:
    info_hash: str
    name: str
    save_path: str
    state: str  # stato nativo del client, non normalizzato
    category: str | None = None
    tracker_url: str | None = None
    files: list[ClientTorrentFileInfo] = field(default_factory=list)


class TorrentAddTimeoutError(Exception):
    """Il torrent non è comparso nel client entro il timeout dopo l'aggiunta."""


class TorrentClientAdapter(ABC):
    @abstractmethod
    def add_torrent(self, torrent_file_or_url: str, save_path: str, force_recheck: bool = True) -> str:
        """Aggiunge il torrent puntando a save_path (il file già hardlinkato,
        o già presente per la direzione torrent->client di SPEC.md sezione 3).
        force_recheck deve essere True di default e non deve mai essere
        impostabile a False da nessun chiamante del motore di matching
        (Fase 4). Ritorna l'info_hash del torrent aggiunto."""
        raise NotImplementedError

    @abstractmethod
    def get_torrent_status(self, info_hash: str) -> TorrentStatus:
        raise NotImplementedError

    @abstractmethod
    def list_torrents(self) -> list[ClientTorrentInfo]:
        """Ogni torrent noto al client, coi suoi file. Usata per popolare
        client_torrent/client_torrent_file (Fase 2) — mai per aggiungere o
        modificare nulla sul client."""
        raise NotImplementedError
