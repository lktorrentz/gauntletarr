import hashlib
import os
from datetime import UTC, datetime

from app import full_check, pipeline
from app.models import Candidate, CandidateFile, Disk, MediaFile, MediaItem, SeedJob, Tracker

PIECE = 16


def _bencode(value) -> bytes:
    if isinstance(value, int):
        return b"i" + str(value).encode() + b"e"
    if isinstance(value, bytes):
        return str(len(value)).encode() + b":" + value
    if isinstance(value, str):
        return _bencode(value.encode())
    if isinstance(value, list):
        return b"l" + b"".join(_bencode(v) for v in value) + b"e"
    if isinstance(value, dict):
        items = sorted(value.items(), key=lambda kv: kv[0].encode() if isinstance(kv[0], str) else kv[0])
        return b"d" + b"".join(_bencode(k) + _bencode(v) for k, v in items) + b"e"
    raise TypeError(type(value))


def _torrent(folder: str, files: dict[str, bytes]) -> bytes:
    stream = b"".join(files.values())
    pieces = b"".join(hashlib.sha1(stream[i:i + PIECE]).digest() for i in range(0, len(stream), PIECE))
    info = {
        "name": folder, "piece length": PIECE, "pieces": pieces,
        "files": [{"length": len(data), "path": path.split("/")} for path, data in files.items()],
    }
    return _bencode({"info": info})


# Due file con lunghezze non multiple del piece: il secondo piece è a cavallo.
FILES = {"Movie.2001.mkv": b"A" * 24 + b"B" * 16, "Movie.2001.nfo": b"nfo-data-here!!"}


def _setup(db_session, tmp_path, library: dict[str, bytes]):
    root = tmp_path / "disk"
    (root / "media/Movie (2001)").mkdir(parents=True)
    (root / "torrents").mkdir()
    disk = Disk(label="d", root_path=str(root), media_rel_path="media", torrents_rel_path="torrents")
    tracker = Tracker(label="t", adapter_type="unit3d", base_url="https://t.example", api_token="x")
    item = MediaItem(content_type="movie", tmdb_id=1)
    db_session.add_all([disk, tracker, item])
    db_session.commit()
    run = pipeline.start_run(db_session, "manual")
    candidate = Candidate(
        media_item_id=item.id, tracker_id=tracker.id, torrent_id_remote="1", name="Movie", size_bytes=55,
        source="catalog_search", direction="media_to_torrent", confidence=0.9, folder="Movie",
        download_link="https://t.example/dl/1",
    )
    db_session.add(candidate)
    db_session.commit()
    for name, data in library.items():
        rel = f"media/Movie (2001)/{name}"
        (root / rel).write_bytes(data)
        mf = MediaFile(disk_id=disk.id, relative_path=rel, size_bytes=len(data), st_dev=1, inode=1,
                       media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC))
        db_session.add(mf)
        db_session.commit()
        db_session.add(CandidateFile(candidate_id=candidate.id, torrent_path=name, size_bytes=len(data),
                                     is_video=name.endswith(".mkv"), media_file_id=mf.id))
    db_session.commit()
    return disk, candidate


def _check(db_session, candidate, seed_job=None):
    content = _torrent("Movie", FILES)
    return full_check.run_full_check(db_session, candidate, seed_job, fetch_torrent=lambda _: content)


def test_identical_files_verify_at_100_percent_including_the_boundary_piece(db_session, tmp_path):
    _, candidate = _setup(db_session, tmp_path, FILES)

    result = _check(db_session, candidate)

    assert (result.ok, result.pieces, result.mismatched, result.unreadable) == (4, 4, 0, 0)
    assert result.percent == 100.0
    assert [f.location for f in result.files] == ["library", "library"]


def test_a_changed_byte_is_reported_on_the_file_and_piece_it_belongs_to(db_session, tmp_path):
    changed = dict(FILES)
    changed["Movie.2001.mkv"] = b"A" * 24 + b"B" * 15 + b"X"
    _, candidate = _setup(db_session, tmp_path, changed)

    result = _check(db_session, candidate)

    assert result.mismatched == 1 and result.bad_pieces == [2]  # il piece 32..48, a cavallo dei due file
    video, nfo = result.files
    assert (video.ok, video.mismatched, video.first_bad_offset) == (2, 1, 32)
    assert (nfo.ok, nfo.mismatched) == (1, 1)


def test_a_missing_file_makes_its_pieces_unreadable_not_mismatched(db_session, tmp_path):
    _, candidate = _setup(db_session, tmp_path, {"Movie.2001.mkv": FILES["Movie.2001.mkv"]})

    result = _check(db_session, candidate)

    assert result.mismatched == 0 and result.unreadable == 2
    assert result.files[1].local_path is None


def test_after_an_execution_the_files_are_read_where_the_client_sees_them(db_session, tmp_path):
    disk, candidate = _setup(db_session, tmp_path, FILES)
    video = next(f for f in candidate.files if f.is_video)
    seed_dir = tmp_path / "disk/torrents/Movie"
    seed_dir.mkdir()
    os.link(tmp_path / "disk" / video.media_file.relative_path, seed_dir / "Movie.2001.mkv")  # nfo mai linkato
    job = SeedJob(candidate_id=candidate.id, source_media_file_id=video.media_file_id, final_status="failed")
    db_session.add(job)
    db_session.commit()

    result = _check(db_session, candidate, job)

    assert [f.location for f in result.files] == ["seed", "library"]
    assert result.percent == 100.0


def test_background_check_runs_and_reports_progress(db_session, tmp_path):
    _, candidate = _setup(db_session, tmp_path, FILES)
    content = _torrent("Movie", FILES)
    factory = lambda: db_session  # noqa: E731 — la stessa sessione del test

    state = full_check.start_check(factory, db_session, candidate.id, fetch_torrent=lambda _: content)
    full_check._executor.submit(lambda: None).result()  # aspetta la coda (un worker)

    assert state.status == "done", state.error
    assert state.bytes_done == state.bytes_total == 55
    assert state.result["percent"] == 100.0
