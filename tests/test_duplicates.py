from datetime import UTC, datetime

from app.duplicates import compute_fast_hash, find_duplicate_media_files
from app.models import Disk, MediaFile, RunLog


def _session(client):
    return client.app.state.session_factory()


def test_compute_fast_hash_same_content_same_hash(tmp_path):
    a = tmp_path / "a.mkv"
    b = tmp_path / "b.mkv"
    a.write_bytes(b"x" * 200_000)
    b.write_bytes(b"x" * 200_000)
    assert compute_fast_hash(str(a)) == compute_fast_hash(str(b))


def test_compute_fast_hash_different_tail_different_hash(tmp_path):
    a = tmp_path / "a.mkv"
    b = tmp_path / "b.mkv"
    a.write_bytes(b"x" * 200_000)
    b.write_bytes(b"x" * 199_999 + b"y")
    assert compute_fast_hash(str(a)) != compute_fast_hash(str(b))


def test_compute_fast_hash_missing_file_returns_none(tmp_path):
    assert compute_fast_hash(str(tmp_path / "missing.mkv")) is None


def _make_media_file(session, disk, run, *, relative_path, size_bytes, st_dev, inode, content_hash):
    mf = MediaFile(
        disk_id=disk.id, relative_path=relative_path, size_bytes=size_bytes,
        st_dev=st_dev, inode=inode, content_hash=content_hash,
        last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    session.add(mf)
    return mf


def test_find_duplicate_media_files_flags_same_content_different_inode(client):
    session = _session(client)
    try:
        disk = Disk(label="d", root_path="/mnt/d")
        session.add(disk)
        session.commit()
        run = RunLog(run_type="manual", started_at=datetime.now(UTC))
        session.add(run)
        session.commit()

        _make_media_file(
            session, disk, run, relative_path="movies/A/Movie.mkv",
            size_bytes=1000, st_dev=1, inode=1, content_hash="deadbeef",
        )
        _make_media_file(
            session, disk, run, relative_path="movies/B/Movie.mkv",
            size_bytes=1000, st_dev=1, inode=2, content_hash="deadbeef",
        )
        session.commit()

        groups = find_duplicate_media_files(session)
        assert len(groups) == 1
        assert groups[0]["content_hash"] == "deadbeef"
        assert {f["relative_path"] for f in groups[0]["files"]} == {"movies/A/Movie.mkv", "movies/B/Movie.mkv"}
    finally:
        session.close()


def test_find_duplicate_media_files_excludes_already_hardlinked(client):
    session = _session(client)
    try:
        disk = Disk(label="d", root_path="/mnt/d")
        session.add(disk)
        session.commit()
        run = RunLog(run_type="manual", started_at=datetime.now(UTC))
        session.add(run)
        session.commit()

        # Stesso (st_dev, inode): due path per lo stesso file fisico, nessuno spreco.
        _make_media_file(
            session, disk, run, relative_path="movies/A/Movie.mkv",
            size_bytes=1000, st_dev=1, inode=1, content_hash="deadbeef",
        )
        _make_media_file(
            session, disk, run, relative_path="movies/B/Movie.mkv",
            size_bytes=1000, st_dev=1, inode=1, content_hash="deadbeef",
        )
        session.commit()

        assert find_duplicate_media_files(session) == []
    finally:
        session.close()


def test_find_duplicate_media_files_ignores_null_hash(client):
    session = _session(client)
    try:
        disk = Disk(label="d", root_path="/mnt/d")
        session.add(disk)
        session.commit()
        run = RunLog(run_type="manual", started_at=datetime.now(UTC))
        session.add(run)
        session.commit()

        _make_media_file(
            session, disk, run, relative_path="movies/A/Movie.mkv",
            size_bytes=1000, st_dev=1, inode=1, content_hash=None,
        )
        _make_media_file(
            session, disk, run, relative_path="movies/B/Movie.mkv",
            size_bytes=1000, st_dev=1, inode=2, content_hash=None,
        )
        session.commit()

        assert find_duplicate_media_files(session) == []
    finally:
        session.close()
