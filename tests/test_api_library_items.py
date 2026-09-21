from datetime import UTC, datetime

from app.models import Disk, MediaFile, MediaItem, MediaPath, RunLog


def _session(client):
    return client.app.state.session_factory()


def test_library_items_groups_files_under_media_item(client):
    session = _session(client)
    try:
        disk = Disk(label="d", root_path="/mnt/d")
        session.add(disk)
        session.commit()
        mp = MediaPath(disk_id=disk.id, relative_path="movies", content_type="movie")
        session.add(mp)
        session.commit()
        run = RunLog(run_type="manual", started_at=datetime.now(UTC))
        session.add(run)
        session.commit()
        item = MediaItem(content_type="movie", tmdb_id=157336, tmdb_poster_path="/poster.jpg")
        session.add(item)
        session.commit()
        mf = MediaFile(
            media_path_id=mp.id, disk_id=disk.id, relative_path="movies/Interstellar.mkv", size_bytes=1,
            st_dev=1, inode=1, media_item_id=item.id, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
        )
        session.add(mf)
        session.commit()
    finally:
        session.close()

    response = client.get("/api/library/items")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["tmdb_id"] == 157336
    assert items[0]["has_poster"] is True
    assert len(items[0]["files"]) == 1
    assert items[0]["files"][0]["state"] == "orphan_media"


def test_library_items_empty_when_no_data(client):
    response = client.get("/api/library/items")
    assert response.status_code == 200
    assert response.json() == []


def test_poster_not_cached_returns_404(client):
    response = client.get("/api/library/posters/999999.jpg")
    assert response.status_code == 404
