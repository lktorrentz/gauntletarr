from datetime import UTC, datetime

from app import matching, pipeline
from app.adapters.tracker.base import TorrentCandidate
from app.models import Candidate, Disk, MediaFile, MediaItem, SeedFile, Tracker


def _tc(**overrides) -> TorrentCandidate:
    defaults = dict(
        torrent_id_remote="1", info_hash=None, name="Movie.2024.mkv", size_bytes=1000,
        file_list=["Movie.2024.mkv"], mediainfo_unique_id=None, download_link=None,
    )
    defaults.update(overrides)
    return TorrentCandidate(**defaults)


class FakeTrackerAdapter:
    def __init__(self, candidates):
        self._candidates = candidates

    def search_by_tmdb(self, tmdb_id):
        return self._candidates


def test_score_size_only_match(monkeypatch):
    monkeypatch.setattr(matching, "compute_unique_id", lambda path: None)
    confidence, size_match, mediainfo_match, ambiguity = matching.score_candidate(
        "/media/Movie.2024.mkv", 1000, _tc(size_bytes=1000)
    )
    assert confidence == matching.CONFIDENCE_SIZE_ONLY
    assert size_match is True
    assert mediainfo_match is None


def test_score_no_match_on_size_mismatch():
    confidence, size_match, mediainfo_match, ambiguity = matching.score_candidate(
        "/media/Movie.2024.mkv", 1000, _tc(size_bytes=999)
    )
    assert confidence == matching.CONFIDENCE_NO_MATCH
    assert size_match is False


def test_score_mediainfo_match_raises_confidence(monkeypatch):
    monkeypatch.setattr(matching, "compute_unique_id", lambda path: "abc123")
    confidence, size_match, mediainfo_match, ambiguity = matching.score_candidate(
        "/media/Movie.2024.mkv", 1000, _tc(size_bytes=1000, mediainfo_unique_id="abc123")
    )
    assert confidence == matching.CONFIDENCE_SIZE_AND_MEDIAINFO_MATCH
    assert mediainfo_match is True


def test_score_mediainfo_mismatch_zeroes_confidence(monkeypatch):
    monkeypatch.setattr(matching, "compute_unique_id", lambda path: "different")
    confidence, size_match, mediainfo_match, ambiguity = matching.score_candidate(
        "/media/Movie.2024.mkv", 1000, _tc(size_bytes=1000, mediainfo_unique_id="abc123")
    )
    assert confidence == matching.CONFIDENCE_NO_MATCH
    assert mediainfo_match is False
    assert ambiguity == "mediainfo_mismatch"


def test_score_season_pack_is_never_matched():
    confidence, size_match, mediainfo_match, ambiguity = matching.score_candidate(
        "/media/Show.S01E01.mkv", 1000, _tc(file_list=["a.mkv", "b.mkv"])
    )
    assert confidence == matching.CONFIDENCE_NO_MATCH
    assert ambiguity == "season_pack_not_supported"


def test_match_file_persists_one_candidate_per_torrent_candidate(db_session, monkeypatch):
    monkeypatch.setattr(matching, "compute_unique_id", lambda path: None)
    tracker = Tracker(label="t", adapter_type="unit3d", base_url="https://t.example", api_token="x")
    db_session.add(tracker)
    db_session.commit()
    media_item = MediaItem(content_type="movie", tmdb_id=157336)
    db_session.add(media_item)
    db_session.commit()

    adapter = FakeTrackerAdapter(
        [_tc(torrent_id_remote="1", size_bytes=1000), _tc(torrent_id_remote="2", size_bytes=999)]
    )

    candidates = matching.match_file(
        db_session, media_item.id, 157336, "/media/Movie.2024.mkv", 1000, tracker, adapter, "media_to_torrent"
    )

    assert len(candidates) == 2
    assert db_session.query(Candidate).count() == 2
    by_remote = {c.torrent_id_remote: c for c in candidates}
    assert by_remote["1"].confidence == matching.CONFIDENCE_SIZE_ONLY
    assert by_remote["2"].confidence == matching.CONFIDENCE_NO_MATCH
    assert all(c.direction == "media_to_torrent" for c in candidates)


def _make_disk(db_session):
    disk = Disk(label="d", root_path="/mnt/d", media_rel_path="movies", torrents_rel_path="torrents")
    db_session.add(disk)
    db_session.commit()
    return disk


def test_orphan_media_files_excludes_hardlinked(db_session):
    disk = _make_disk(db_session)
    run = pipeline.start_run(db_session, "manual")
    item = MediaItem(content_type="movie", tmdb_id=1)
    db_session.add(item)
    db_session.commit()

    linked = MediaFile(
        disk_id=disk.id, relative_path="movies/linked.mkv", size_bytes=1,
        st_dev=1, inode=1, media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    orphan = MediaFile(
        disk_id=disk.id, relative_path="movies/orphan.mkv", size_bytes=1,
        st_dev=1, inode=2, media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add_all([linked, orphan])
    db_session.commit()
    seed_file = SeedFile(
        disk_id=disk.id, relative_path="torrents/linked.mkv", size_bytes=1, st_dev=1, inode=1,
        media_file_id=linked.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(seed_file)
    db_session.commit()

    orphans = matching.orphan_media_files(db_session)

    assert [mf.id for mf in orphans] == [orphan.id]
