import httpx

from app.adapters.media_resolver.filename_parser import FilenameParserResolver
from app.tmdb_client import TMDBClient


def _resolver(handler):
    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://api.themoviedb.org/3")
    return FilenameParserResolver(TMDBClient(api_key="key123", client=client))


def test_resolves_a_movie():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/search/movie")
        assert "Interstellar" in request.url.params["query"]
        return httpx.Response(200, json={"results": [{"id": 157336, "poster_path": "/interstellar.jpg"}]})

    resolver = _resolver(handler)
    result = resolver.resolve("Interstellar.2014.2160p.UHD.BluRay.mkv")

    assert result is not None
    assert result.tmdb_id == 157336
    assert result.content_type == "movie"
    assert result.season_number is None
    assert result.poster_path == "/interstellar.jpg"


def test_resolves_a_tv_episode():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/search/tv")
        return httpx.Response(200, json={"results": [{"id": 1399, "poster_path": "/got.jpg"}]})

    resolver = _resolver(handler)
    result = resolver.resolve("Game.of.Thrones.S03E09.The.Rains.of.Castamere.mkv")

    assert result is not None
    assert result.tmdb_id == 1399
    assert result.content_type == "tv"
    assert result.season_number == 3
    assert result.episode_number == 9


def test_returns_none_when_tmdb_has_no_match():
    handler = lambda request: httpx.Response(200, json={"results": []})  # noqa: E731
    resolver = _resolver(handler)

    assert resolver.resolve("Interstellar.2014.mkv") is None


def test_returns_none_for_unparsable_filename():
    # guessit potrebbe comunque estrarre un titolo spurio da una stringa senza
    # senso — non assumiamo che TMDB non venga proprio chiamato, solo che il
    # risultato finale sia None quando TMDB non trova nulla di sensato.
    handler = lambda request: httpx.Response(200, json={"results": []})  # noqa: E731
    resolver = _resolver(handler)

    assert resolver.resolve("asdf1234.mkv") is None


def test_returns_none_for_tv_file_without_episode_number():
    # Un file senza season/episode isolabili (season pack) non è ancora gestito
    # qui — territorio del motore di matching, Fase 4 (docs/SPEC.md sezione 3).
    handler = lambda request: httpx.Response(200, json={"results": []})  # noqa: E731
    resolver = _resolver(handler)

    assert resolver.resolve("Game.of.Thrones.Season.3.Complete.mkv") is None
