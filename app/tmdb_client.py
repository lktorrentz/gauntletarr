"""Client TMDB minimale (solo ricerca, sezione 6 di docs/SPEC.md).

Nessuna libreria wrapper esterna: due endpoint (search/movie, search/tv)
sono l'unica cosa che serve al resolver di default. `client` iniettabile
per i test (stesso pattern di app/adapters/torrent_client/qbittorrent.py),
mai una connessione reale nei test.
"""

from typing import Protocol

import httpx

TMDB_API_BASE = "https://api.themoviedb.org/3"


class TMDBSearchClient(Protocol):
    """Interfaccia strutturale condivisa da TMDBClient e da
    app.tmdb_cache.CachingTMDBClient — FilenameParserResolver accetta
    l'una o l'altra senza saperlo (typing strutturale, nessuna eredità)."""

    def search_movie(self, query: str, year: int | None = None) -> dict | None: ...
    def search_tv(self, query: str, year: int | None = None) -> dict | None: ...


class TMDBClient:
    def __init__(self, api_key: str, client: httpx.Client | None = None):
        self.api_key = api_key
        self._client = client or httpx.Client(base_url=TMDB_API_BASE, timeout=10.0)

    def search_movie(self, query: str, year: int | None = None) -> dict | None:
        return self._search("/search/movie", query, {"year": year} if year else {})

    def search_tv(self, query: str, year: int | None = None) -> dict | None:
        return self._search("/search/tv", query, {"first_air_date_year": year} if year else {})

    def _search(self, path: str, query: str, extra_params: dict) -> dict | None:
        params = {"api_key": self.api_key, "query": query, **extra_params}
        response = self._client.get(path, params=params)
        response.raise_for_status()
        results = response.json().get("results", [])
        return results[0] if results else None
