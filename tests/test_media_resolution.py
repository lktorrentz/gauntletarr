from datetime import UTC, datetime

from app import media_resolution, pipeline
from app.adapters.media_resolver.base import MediaResolverAdapter, ResolvedMedia
from app.models import Disk, MediaFile, MediaItem, MediaPath


class FakeResolver(MediaResolverAdapter):
    SOURCE = "filename_parser"

    def __init__(self, results: dict[str, ResolvedMedia | None]):
        # results keyed by relative_path piece contained in the abs_path, per test comodità
        self._results = results

    def resolve(self, file_path: str, content_type: str) -> ResolvedMedia | None:
        for key, value in self._results.items():
            if key in file_path:
                if isinstance(value, Exception):
                    raise value
                return value
        return None


def _make_media_file(db_session, disk, media_path, relative_path, run):
    mf = MediaFile(
        media_path_id=media_path.id, disk_id=disk.id, relative_path=relative_path,
        size_bytes=1, st_dev=1, inode=1, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(mf)
    db_session.commit()
    return mf


def _setup(db_session):
    disk = Disk(label="disk1", root_path="/mnt/disk1")
    db_session.add(disk)
    db_session.commit()
    media_path = MediaPath(disk_id=disk.id, relative_path="movies", content_type="movie")
    db_session.add(media_path)
    db_session.commit()
    run = pipeline.start_run(db_session, run_type="manual")
    return disk, media_path, run


def test_resolves_and_creates_media_item(db_session, tmp_path):
    disk, media_path, run = _setup(db_session)
    _make_media_file(db_session, disk, media_path, "movies/Interstellar.2014.mkv", run)

    resolver = FakeResolver({
        "Interstellar": ResolvedMedia(tmdb_id=157336, content_type="movie", poster_path=None),
    })

    counts = media_resolution.resolve_unmatched_media_files(db_session, resolver, str(tmp_path / "posters"))

    assert counts == {"resolved": 1, "unresolved": 0}
    mf = db_session.query(MediaFile).one()
    assert mf.media_item_id is not None
    assert mf.resolver_source == "filename_parser"
    media_item = db_session.query(MediaItem).one()
    assert media_item.tmdb_id == 157336
    assert media_item.content_type == "movie"


def test_two_files_same_movie_share_one_media_item(db_session, tmp_path):
    disk, media_path, run = _setup(db_session)
    _make_media_file(db_session, disk, media_path, "movies/Interstellar.2014.mkv", run)
    _make_media_file(db_session, disk, media_path, "movies/Interstellar.2014.Extended.mkv", run)

    resolver = FakeResolver({
        "Interstellar": ResolvedMedia(tmdb_id=157336, content_type="movie"),
    })

    counts = media_resolution.resolve_unmatched_media_files(db_session, resolver, str(tmp_path / "posters"))

    assert counts == {"resolved": 2, "unresolved": 0}
    assert db_session.query(MediaItem).count() == 1


def test_two_episodes_same_show_get_distinct_media_items(db_session, tmp_path):
    disk, media_path, run = _setup(db_session)
    _make_media_file(db_session, disk, media_path, "movies/GoT.S03E01.mkv", run)
    _make_media_file(db_session, disk, media_path, "movies/GoT.S03E09.mkv", run)

    resolver = FakeResolver({
        "S03E01": ResolvedMedia(tmdb_id=1399, content_type="tv", season_number=3, episode_number=1),
        "S03E09": ResolvedMedia(tmdb_id=1399, content_type="tv", season_number=3, episode_number=9),
    })

    media_resolution.resolve_unmatched_media_files(db_session, resolver, str(tmp_path / "posters"))

    assert db_session.query(MediaItem).count() == 2


def test_unresolvable_file_counted_as_unresolved(db_session, tmp_path):
    disk, media_path, run = _setup(db_session)
    _make_media_file(db_session, disk, media_path, "movies/Unknown.Thing.mkv", run)

    resolver = FakeResolver({})  # nessun match per nessun file

    counts = media_resolution.resolve_unmatched_media_files(db_session, resolver, str(tmp_path / "posters"))

    assert counts == {"resolved": 0, "unresolved": 1}
    mf = db_session.query(MediaFile).one()
    assert mf.media_item_id is None


def test_resolver_exception_on_one_file_does_not_abort_the_rest(db_session, tmp_path):
    disk, media_path, run = _setup(db_session)
    _make_media_file(db_session, disk, media_path, "movies/Broken.mkv", run)
    _make_media_file(db_session, disk, media_path, "movies/Interstellar.2014.mkv", run)

    resolver = FakeResolver({
        "Broken": RuntimeError("network error"),
        "Interstellar": ResolvedMedia(tmdb_id=157336, content_type="movie"),
    })

    counts = media_resolution.resolve_unmatched_media_files(db_session, resolver, str(tmp_path / "posters"))

    assert counts == {"resolved": 1, "unresolved": 1}


def test_already_resolved_files_are_skipped(db_session, tmp_path):
    disk, media_path, run = _setup(db_session)
    mf = _make_media_file(db_session, disk, media_path, "movies/Interstellar.2014.mkv", run)
    existing_item = MediaItem(content_type="movie", tmdb_id=1)
    db_session.add(existing_item)
    db_session.commit()
    mf.media_item_id = existing_item.id
    db_session.commit()

    def _unreachable(*args, **kwargs):
        raise AssertionError("non deve richiamare il resolver per un file già risolto")

    resolver = FakeResolver({})
    resolver.resolve = _unreachable

    counts = media_resolution.resolve_unmatched_media_files(db_session, resolver, str(tmp_path / "posters"))

    assert counts == {"resolved": 0, "unresolved": 0}
