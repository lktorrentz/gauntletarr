import httpx
import pytest

from app.adapters.tracker.base import NotSupportedError, Unit3dTrackerAdapter


def _adapter(handler, **kwargs):
    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://tracker.example")
    return Unit3dTrackerAdapter(base_url="https://tracker.example", api_token="tok123", http_client=client, **kwargs)


def test_search_by_tmdb_parses_single_file_candidate():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["tmdbId"] == "157336"
        assert request.headers["Authorization"] == "Bearer tok123"
        return httpx.Response(200, json={
            "data": [{
                "type": "torrent", "id": "42",
                "attributes": {
                    "name": "Interstellar.2014.2160p.UHD.BluRay.mkv",
                    "size": 123456789,
                    "files": [{"name": "Interstellar.2014.2160p.UHD.BluRay.mkv", "size": 123456789}],
                    "media_info": "General\nUnique ID                               : 12345 (0x3039)\n",
                    "folder": None,
                    "download_link": "https://tracker.example/download/42",
                },
            }],
        })

    adapter = _adapter(handler)
    candidates = adapter.search_by_tmdb(157336)

    assert len(candidates) == 1
    c = candidates[0]
    assert c.torrent_id_remote == "42"
    assert c.info_hash is None  # mai esposto da UNIT3D
    assert c.size_bytes == 123456789
    assert c.mediainfo_unique_id == "12345"
    assert c.download_link == "https://tracker.example/download/42"


def test_search_by_tmdb_caches_results(monkeypatch):
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(200, json={"data": []})

    adapter = _adapter(handler, cache_ttl_seconds=600)
    adapter.search_by_tmdb(1)
    adapter.search_by_tmdb(1)

    assert call_count == 1


def test_embedded_folder_stripped_from_pack_filenames():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={
            "data": [{
                "type": "torrent", "id": "43",
                "attributes": {
                    "name": "Show.S01",
                    "size": 999,
                    "files": [
                        {"name": "Release.Name/Show.S01E01.mkv", "size": 100},
                        {"name": "Release.Name/Show.S01E02.mkv", "size": 200},
                    ],
                    "media_info": None,
                    "folder": None,
                    "download_link": "https://tracker.example/download/43",
                },
            }],
        })

    adapter = _adapter(handler)
    candidate = adapter.search_by_tmdb(1)[0]

    assert candidate.folder == "Release.Name"
    assert candidate.file_list == ["Show.S01E01.mkv", "Show.S01E02.mkv"]
    assert candidate.file_sizes == {"Show.S01E01.mkv": 100, "Show.S01E02.mkv": 200}


def test_extract_unique_ids_by_filename_for_a_pack():
    media_info = (
        "General\nComplete name                            : Release/Show.S01E01.mkv\n"
        "Unique ID                               : 111 (0x6f)\n"
        "General\nComplete name                            : Release/Show.S01E02.mkv\n"
        "Unique ID                               : 222 (0xde)\n"
    )
    result = Unit3dTrackerAdapter._extract_unique_ids_by_filename(media_info)

    assert result == {"Show.S01E01.mkv": "111", "Show.S01E02.mkv": "222"}


def test_get_own_history_raises_not_supported():
    adapter = _adapter(lambda request: httpx.Response(200, json={}))
    with pytest.raises(NotSupportedError):
        adapter.get_own_history()


def test_raises_on_http_error():
    handler = lambda request: httpx.Response(401, json={})  # noqa: E731
    adapter = _adapter(handler)

    with pytest.raises(httpx.HTTPStatusError):
        adapter.search_by_tmdb(1)
