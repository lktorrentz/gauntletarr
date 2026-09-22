import os
from datetime import UTC, datetime

import pytest

from app import executor, pipeline
from app.adapters.torrent_client.base import TorrentStatus
from app.models import Candidate, Disk, MatchReview, MediaFile, MediaItem, SeedFile, Tracker


class FakeAdapter:
    def __init__(self, info_hash="deadbeef", recheck_status="ok"):
        self.info_hash = info_hash
        self.recheck_status = recheck_status
        self.add_torrent_calls = []

    def add_torrent(self, torrent_file_or_url, save_path, force_recheck=True):
        assert force_recheck is True
        self.add_torrent_calls.append({"url": torrent_file_or_url, "save_path": save_path})
        return self.info_hash

    def get_torrent_status(self, info_hash):
        return TorrentStatus(info_hash=info_hash, state="uploading", recheck_status=self.recheck_status, progress=1.0)

    def list_torrents(self):
        return []


def _make_disk_media_path(tmp_path):
    root = tmp_path / "disk1"
    (root / "media" / "movies").mkdir(parents=True)
    (root / "torrents").mkdir(parents=True)
    return root


def _base_setup(db_session, tmp_path):
    root = _make_disk_media_path(tmp_path)
    disk = Disk(label="d", root_path=str(root), media_rel_path="media/movies", torrents_rel_path="torrents")
    db_session.add(disk)
    db_session.commit()
    tracker = Tracker(label="t", adapter_type="unit3d", base_url="https://t.example", api_token="x")
    db_session.add(tracker)
    db_session.commit()
    item = MediaItem(content_type="movie", tmdb_id=1)
    db_session.add(item)
    db_session.commit()
    run = pipeline.start_run(db_session, "manual")
    return root, disk, tracker, item, run


def test_execute_media_to_torrent_creates_hardlink_and_adds_torrent(db_session, tmp_path):
    root, disk, tracker, item, run = _base_setup(db_session, tmp_path)

    media_file_path = root / "media" / "movies" / "Movie.2024.mkv"
    media_file_path.write_bytes(b"content")
    media_file = MediaFile(
        disk_id=disk.id, relative_path="media/movies/Movie.2024.mkv", size_bytes=7,
        st_dev=1, inode=1, media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(media_file)
    db_session.commit()

    candidate = Candidate(
        media_item_id=item.id, tracker_id=tracker.id, torrent_id_remote="1", name="Movie.2024.mkv",
        size_bytes=7, source="catalog_search", direction="media_to_torrent", confidence=1.0,
        download_link="https://t.example/dl/1", file_list_json='["Movie.2024.mkv"]',
    )
    db_session.add(candidate)
    db_session.commit()
    match_review = MatchReview(candidate_id=candidate.id, media_file_id=media_file.id, status="approved")
    db_session.add(match_review)
    db_session.commit()

    adapter = FakeAdapter()
    seed_job = executor.execute_review(db_session, match_review, adapter)

    expected_link = root / "torrents" / "Movie.2024.mkv"
    assert expected_link.is_file()
    assert os.path.samefile(media_file_path, expected_link)
    assert seed_job.hardlink_created_at is not None
    assert seed_job.info_hash == "deadbeef"
    assert seed_job.recheck_status == "pending"
    assert len(adapter.add_torrent_calls) == 1


def test_execute_media_to_torrent_respects_candidate_folder(db_session, tmp_path):
    root, disk, tracker, item, run = _base_setup(db_session, tmp_path)
    media_file_path = root / "media" / "movies" / "Movie.2024.mkv"
    media_file_path.write_bytes(b"content")
    media_file = MediaFile(
        disk_id=disk.id, relative_path="media/movies/Movie.2024.mkv", size_bytes=7,
        st_dev=1, inode=1, media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(media_file)
    db_session.commit()
    candidate = Candidate(
        media_item_id=item.id, tracker_id=tracker.id, torrent_id_remote="1", name="Movie.2024.mkv",
        size_bytes=7, source="catalog_search", direction="media_to_torrent", confidence=1.0,
        download_link="https://t.example/dl/1", file_list_json='["Movie.2024.mkv"]', folder="Release.Name",
    )
    db_session.add(candidate)
    db_session.commit()
    match_review = MatchReview(candidate_id=candidate.id, media_file_id=media_file.id, status="approved")
    db_session.add(match_review)
    db_session.commit()

    executor.execute_review(db_session, match_review, FakeAdapter())

    assert (root / "torrents" / "Release.Name" / "Movie.2024.mkv").is_file()


def test_execute_media_to_torrent_fails_on_cross_device(db_session, tmp_path, monkeypatch):
    root, disk, tracker, item, run = _base_setup(db_session, tmp_path)
    media_file_path = root / "media" / "movies" / "Movie.2024.mkv"
    media_file_path.write_bytes(b"content")
    media_file = MediaFile(
        disk_id=disk.id, relative_path="media/movies/Movie.2024.mkv", size_bytes=7,
        st_dev=1, inode=1, media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(media_file)
    db_session.commit()
    candidate = Candidate(
        media_item_id=item.id, tracker_id=tracker.id, torrent_id_remote="1", name="Movie.2024.mkv",
        size_bytes=7, source="catalog_search", direction="media_to_torrent", confidence=1.0,
        download_link="https://t.example/dl/1", file_list_json='["Movie.2024.mkv"]',
    )
    db_session.add(candidate)
    db_session.commit()
    match_review = MatchReview(candidate_id=candidate.id, media_file_id=media_file.id, status="approved")
    db_session.add(match_review)
    db_session.commit()

    real_stat = os.stat

    def fake_stat(path, *a, **kw):
        result = real_stat(path, *a, **kw)
        if str(path) == str(media_file_path):
            # os.path.isfile() (chiamato prima di _check_same_filesystem) usa
            # anche st_mode: serve un os.stat_result completo, non un oggetto
            # con solo st_dev, altrimenti fallisce lì invece che dove vogliamo.
            seq = list(result)
            seq[2] = result.st_dev + 1  # indice 2 = st_dev nella sequenza stat_result
            return os.stat_result(seq)
        return result

    monkeypatch.setattr(executor.os, "stat", fake_stat)

    with pytest.raises(executor.ExecutionError, match="different devices"):
        executor.execute_review(db_session, match_review, FakeAdapter())


def test_execute_torrent_to_client_adds_existing_file_without_new_hardlink(db_session, tmp_path):
    root, disk, tracker, item, run = _base_setup(db_session, tmp_path)
    existing_file = root / "torrents" / "Standalone.2024.mkv"
    existing_file.write_bytes(b"content")
    media_file = MediaFile(
        disk_id=disk.id, relative_path="media/movies/Standalone.2024.mkv", size_bytes=7,
        st_dev=1, inode=1, media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(media_file)
    db_session.commit()
    seed_file = SeedFile(
        disk_id=disk.id, relative_path="torrents/Standalone.2024.mkv", size_bytes=7, st_dev=1, inode=2,
        media_file_id=media_file.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(seed_file)
    db_session.commit()
    candidate = Candidate(
        media_item_id=item.id, tracker_id=tracker.id, torrent_id_remote="1", name="Standalone.2024.mkv",
        size_bytes=7, source="catalog_search", direction="torrent_to_client", confidence=1.0,
        download_link="https://t.example/dl/1",
    )
    db_session.add(candidate)
    db_session.commit()
    match_review = MatchReview(candidate_id=candidate.id, seed_file_id=seed_file.id, status="approved")
    db_session.add(match_review)
    db_session.commit()

    adapter = FakeAdapter()
    seed_job = executor.execute_review(db_session, match_review, adapter)

    assert seed_job.hardlink_created_at is None  # nessun nuovo hardlink, il file c'era già
    assert seed_job.info_hash == "deadbeef"
    assert adapter.add_torrent_calls[0]["save_path"] == str(root / "torrents")


def test_execute_without_download_link_fails_explicitly(db_session, tmp_path):
    root, disk, tracker, item, run = _base_setup(db_session, tmp_path)
    existing_file = root / "torrents" / "Standalone.2024.mkv"
    existing_file.write_bytes(b"content")
    media_file = MediaFile(
        disk_id=disk.id, relative_path="media/movies/x.mkv", size_bytes=7,
        st_dev=1, inode=1, media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(media_file)
    db_session.commit()
    seed_file = SeedFile(
        disk_id=disk.id, relative_path="torrents/Standalone.2024.mkv", size_bytes=7, st_dev=1, inode=2,
        media_file_id=media_file.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(seed_file)
    db_session.commit()
    candidate = Candidate(
        media_item_id=item.id, tracker_id=tracker.id, torrent_id_remote="1", name="x",
        size_bytes=7, source="catalog_search", direction="torrent_to_client", confidence=1.0,
        download_link=None,
    )
    db_session.add(candidate)
    db_session.commit()
    match_review = MatchReview(candidate_id=candidate.id, seed_file_id=seed_file.id, status="approved")
    db_session.add(match_review)
    db_session.commit()

    with pytest.raises(executor.ExecutionError, match="download_link"):
        executor.execute_review(db_session, match_review, FakeAdapter())


def test_reconcile_seed_job_updates_status_to_seeding(db_session, tmp_path):
    root, disk, tracker, item, run = _base_setup(db_session, tmp_path)
    candidate = Candidate(
        media_item_id=item.id, tracker_id=tracker.id, torrent_id_remote="1", name="x", size_bytes=1,
        source="catalog_search", direction="media_to_torrent", confidence=1.0,
    )
    db_session.add(candidate)
    db_session.commit()
    from app.models import SeedJob

    seed_job = SeedJob(
        candidate_id=candidate.id, final_status="in_progress", info_hash="deadbeef", recheck_status="pending"
    )
    db_session.add(seed_job)
    db_session.commit()

    executor.reconcile_seed_job(db_session, seed_job, FakeAdapter(recheck_status="ok"))

    assert seed_job.final_status == "seeding"
