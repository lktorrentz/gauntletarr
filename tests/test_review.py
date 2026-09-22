from datetime import UTC, datetime

from app import pipeline, review
from app.models import Candidate, MatchReview, MediaFile, MediaItem, SeedJob, Tracker


def _tracker(db_session):
    t = Tracker(label="t", adapter_type="unit3d", base_url="https://t.example", api_token="x")
    db_session.add(t)
    db_session.commit()
    return t


def _candidate(db_session, item, tracker, *, confidence, direction="media_to_torrent"):
    c = Candidate(
        media_item_id=item.id, tracker_id=tracker.id, torrent_id_remote="1", name="x", size_bytes=1,
        source="catalog_search", direction=direction, confidence=confidence,
    )
    db_session.add(c)
    db_session.commit()
    return c


def _media_item(db_session):
    item = MediaItem(content_type="movie", tmdb_id=1)
    db_session.add(item)
    db_session.commit()
    return item


def _media_file_stub(db_session, item):
    # I test di review.py non toccano il filesystem: bastano id validi via FK,
    # non serve un Disk reale per la sola logica di classificazione.
    from app.models import Disk

    disk = Disk(label="d", root_path="/mnt/d")
    db_session.add(disk)
    db_session.commit()
    run = pipeline.start_run(db_session, "manual")
    mf = MediaFile(
        disk_id=disk.id, relative_path="movies/x.mkv", size_bytes=1,
        st_dev=1, inode=1, media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(mf)
    db_session.commit()
    return mf


def _seed_file_stub(db_session, media_file):
    from app.models import SeedFile

    run = pipeline.start_run(db_session, "manual")
    sf = SeedFile(
        disk_id=media_file.disk_id, relative_path="torrents/x.mkv", size_bytes=1,
        st_dev=1, inode=2, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(sf)
    db_session.commit()
    return sf


def test_high_confidence_creates_auto_approved_review(db_session):
    tracker = _tracker(db_session)
    item = _media_item(db_session)
    mf = _media_file_stub(db_session, item)
    candidate = _candidate(db_session, item, tracker, confidence=0.99)

    result = review.create_review_for_media_file(db_session, mf, [candidate])

    assert result.status == "auto_approved"
    assert result.decided_by == "system"


def test_low_confidence_creates_pending_review(db_session):
    tracker = _tracker(db_session)
    item = _media_item(db_session)
    mf = _media_file_stub(db_session, item)
    candidate = _candidate(db_session, item, tracker, confidence=0.5)

    result = review.create_review_for_media_file(db_session, mf, [candidate])

    assert result.status == "pending"
    assert result.decided_by is None


def test_torrent_to_client_uses_higher_threshold(db_session):
    tracker = _tracker(db_session)
    item = _media_item(db_session)
    mf = _media_file_stub(db_session, item)
    sf = _seed_file_stub(db_session, mf)
    # 0.97 supera la soglia media_to_torrent (0.95) ma non quella
    # torrent_to_client (0.98 di default) — deve restare pending.
    candidate = _candidate(db_session, item, tracker, confidence=0.97, direction="torrent_to_client")

    result = review._create_review(db_session, [candidate], media_file_id=None, seed_file_id=sf.id)

    assert result.status == "pending"


def test_zero_confidence_candidates_produce_no_review(db_session):
    tracker = _tracker(db_session)
    item = _media_item(db_session)
    mf = _media_file_stub(db_session, item)
    candidate = _candidate(db_session, item, tracker, confidence=0.0)

    result = review.create_review_for_media_file(db_session, mf, [candidate])

    assert result is None
    assert db_session.query(MatchReview).count() == 0


def test_rematching_supersedes_previous_active_review(db_session):
    tracker = _tracker(db_session)
    item = _media_item(db_session)
    mf = _media_file_stub(db_session, item)
    first = _candidate(db_session, item, tracker, confidence=0.5)
    review.create_review_for_media_file(db_session, mf, [first])

    second = _candidate(db_session, item, tracker, confidence=0.99)
    new_review = review.create_review_for_media_file(db_session, mf, [second])

    reviews = db_session.query(MatchReview).order_by(MatchReview.id).all()
    assert len(reviews) == 2
    assert reviews[0].status == "rejected"
    assert reviews[0].decided_by == "system"
    assert new_review.status == "auto_approved"


def test_custom_threshold_from_settings(db_session):
    from app import settings_repo

    settings_repo.set_setting(db_session, "confidence_threshold_auto_media_to_torrent", "0.5")
    tracker = _tracker(db_session)
    item = _media_item(db_session)
    mf = _media_file_stub(db_session, item)
    candidate = _candidate(db_session, item, tracker, confidence=0.5)

    result = review.create_review_for_media_file(db_session, mf, [candidate])

    assert result.status == "auto_approved"


def test_approve_without_torrent_client_leaves_review_approved_no_seed_job(db_session):
    tracker = _tracker(db_session)
    item = _media_item(db_session)
    candidate = _candidate(db_session, item, tracker, confidence=0.99)
    match_review = MatchReview(candidate_id=candidate.id, status="pending")
    db_session.add(match_review)
    db_session.commit()

    review.approve(db_session, match_review)

    assert match_review.status == "approved"
    assert db_session.query(SeedJob).count() == 0  # nessun client configurato: esecuzione rimandata


def test_reject_marks_review_rejected(db_session):
    tracker = _tracker(db_session)
    item = _media_item(db_session)
    candidate = _candidate(db_session, item, tracker, confidence=0.5)
    match_review = MatchReview(candidate_id=candidate.id, status="pending")
    db_session.add(match_review)
    db_session.commit()

    review.reject(db_session, match_review)

    assert match_review.status == "rejected"
    assert match_review.decided_by == "user"


def test_list_ready_for_review_excludes_reviews_with_seed_job(db_session):
    tracker = _tracker(db_session)
    item = _media_item(db_session)
    candidate = _candidate(db_session, item, tracker, confidence=0.99)
    match_review = MatchReview(candidate_id=candidate.id, status="auto_approved")
    db_session.add(match_review)
    db_session.commit()
    seed_job = SeedJob(candidate_id=candidate.id, final_status="in_progress")
    db_session.add(seed_job)
    db_session.commit()

    assert review.list_ready_for_review(db_session) == []
