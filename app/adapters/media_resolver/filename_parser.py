"""Resolver di default: parsing filename (guessit) + lookup TMDB.

Sempre disponibile, nessuna dipendenza esterna oltre l'API TMDB
(docs/SPEC.md sezione 6, ereditato da ratio-guardian).
"""

import guessit

from app.adapters.media_resolver.base import MediaResolverAdapter, ResolvedMedia
from app.content_type_guess import guess_content_type_from_guessit
from app.tmdb_client import TMDBSearchClient, year_of


def _first_if_list(value):
    """guessit ritorna una lista per season/episode multi-episodio (es. E01-E02) —
    qui prendiamo il primo, un file multi-episodio isolato non è ancora gestito
    (season pack: territorio del motore di matching, Fase 4)."""
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _result_title(result: dict) -> str | None:
    return result.get("title") or result.get("name")


def _result_year(result: dict) -> int | None:
    # Dalla cache arriva già "year"; da una ricerca TMDB vera la data.
    return result.get("year") or year_of(result.get("release_date") or result.get("first_air_date"))


class FilenameParserResolver(MediaResolverAdapter):
    SOURCE = "filename_parser"

    def __init__(self, tmdb_client: TMDBSearchClient):
        self._tmdb = tmdb_client

    def resolve(self, file_path: str) -> ResolvedMedia | None:
        guess = guessit.guessit(file_path)
        title = guess.get("title")
        if not title:
            return None
        year = _first_if_list(guess.get("year"))
        content_type = guess_content_type_from_guessit(guess)

        if content_type == "movie":
            result = self._tmdb.search_movie(title, year)
            if result is None:
                return None
            return ResolvedMedia(
                tmdb_id=result["id"], content_type="movie", poster_path=result.get("poster_path"), source=self.SOURCE,
                title=_result_title(result), year=_result_year(result),
            )

        season = _first_if_list(guess.get("season"))
        episode = _first_if_list(guess.get("episode"))
        if season is None or episode is None:
            return None
        result = self._tmdb.search_tv(title, year)
        if result is None:
            return None
        return ResolvedMedia(
            tmdb_id=result["id"], content_type="tv",
            season_number=season, episode_number=episode,
            poster_path=result.get("poster_path"), source=self.SOURCE,
            title=_result_title(result), year=_result_year(result),
        )
