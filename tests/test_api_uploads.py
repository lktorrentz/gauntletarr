from app import adapter_factory, upload
from app.adapters.tracker.base import TorrentCandidate
from app.models import Disk, Tracker


def _session(client):
    return client.app.state.session_factory()


def _setup_disk_and_tracker(client, tmp_path, *, announce_url="https://tracker.example/announce"):
    media_dir = tmp_path / "media"
    media_dir.mkdir()
    video = media_dir / "Movie.2024.1080p.WEB.mkv"
    video.write_bytes(b"x" * 20000)

    session = _session(client)
    try:
        disk = Disk(label="d", root_path=str(tmp_path))
        session.add(disk)
        session.commit()
        tracker = Tracker(
            label="t", adapter_type="unit3d", base_url="https://tracker.example", api_token="x",
            announce_url=announce_url,
        )
        session.add(tracker)
        session.commit()
        return disk.id, tracker.id
    finally:
        session.close()


class _FakeImageHostChain:
    def upload(self, image_path: str) -> str:
        return "https://img.example/x.png"


class _FakeTrackerAdapter:
    def __init__(self, candidates=None, torrent_id="4242"):
        self._candidates = candidates or []
        self._torrent_id = torrent_id

    def search_by_tmdb(self, tmdb_id):
        return self._candidates

    def upload_torrent(self, fields, torrent_path):
        return self._torrent_id


class _FakeTorrentClientAdapter:
    def __init__(self):
        self.add_calls = []

    def add_torrent(self, torrent_file_or_url, save_path, force_recheck=True):
        self.add_calls.append((torrent_file_or_url, save_path, force_recheck))
        return "deadbeef"


def test_create_upload_draft(client, tmp_path):
    disk_id, tracker_id = _setup_disk_and_tracker(client, tmp_path)

    response = client.post(
        "/api/uploads",
        json={"disk_id": disk_id, "relative_path": "media/Movie.2024.1080p.WEB.mkv", "tracker_id": tracker_id},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "draft"
    assert body["tracker_id"] == tracker_id


def test_create_upload_rejects_path_outside_disk(client, tmp_path):
    disk_id, tracker_id = _setup_disk_and_tracker(client, tmp_path)

    response = client.post(
        "/api/uploads", json={"disk_id": disk_id, "relative_path": "../outside.mkv", "tracker_id": tracker_id}
    )

    assert response.status_code == 400


def test_create_upload_rejects_directory(client, tmp_path):
    disk_id, tracker_id = _setup_disk_and_tracker(client, tmp_path)

    response = client.post(
        "/api/uploads", json={"disk_id": disk_id, "relative_path": "media", "tracker_id": tracker_id}
    )

    assert response.status_code == 400


def test_prepare_without_profile_returns_400(client, tmp_path):
    disk_id, tracker_id = _setup_disk_and_tracker(client, tmp_path)
    created = client.post(
        "/api/uploads",
        json={"disk_id": disk_id, "relative_path": "media/Movie.2024.1080p.WEB.mkv", "tracker_id": tracker_id},
    ).json()

    response = client.post(f"/api/uploads/{created['id']}/prepare")

    assert response.status_code == 400


def test_prepare_success(client, tmp_path, monkeypatch):
    disk_id, tracker_id = _setup_disk_and_tracker(client, tmp_path)
    client.post(f"/api/trackers/{tracker_id}/upload-profile", json={"profile_key": "itt"})
    created = client.post(
        "/api/uploads",
        json={"disk_id": disk_id, "relative_path": "media/Movie.2024.1080p.WEB.mkv", "tracker_id": tracker_id},
    ).json()

    monkeypatch.setattr(
        upload.screenshots, "generate_screenshots", lambda video_path, output_dir, count=4: []
    )
    monkeypatch.setattr(adapter_factory, "build_image_host_chain", lambda session: _FakeImageHostChain())

    response = client.post(f"/api/uploads/{created['id']}/prepare")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["category_id"] == 1


def test_confirm_requires_ready_status(client, tmp_path):
    disk_id, tracker_id = _setup_disk_and_tracker(client, tmp_path)
    created = client.post(
        "/api/uploads",
        json={"disk_id": disk_id, "relative_path": "media/Movie.2024.1080p.WEB.mkv", "tracker_id": tracker_id},
    ).json()

    response = client.post(f"/api/uploads/{created['id']}/confirm", json={"torrent_client_id": 1})

    assert response.status_code == 400


def test_confirm_success_uploads_and_adds_to_client(client, tmp_path, monkeypatch):
    disk_id, tracker_id = _setup_disk_and_tracker(client, tmp_path)
    client.post(f"/api/trackers/{tracker_id}/upload-profile", json={"profile_key": "itt"})
    created = client.post(
        "/api/uploads",
        json={"disk_id": disk_id, "relative_path": "media/Movie.2024.1080p.WEB.mkv", "tracker_id": tracker_id},
    ).json()
    monkeypatch.setattr(upload.screenshots, "generate_screenshots", lambda video_path, output_dir, count=4: [])
    monkeypatch.setattr(adapter_factory, "build_image_host_chain", lambda session: _FakeImageHostChain())
    client.post(f"/api/uploads/{created['id']}/prepare")
    client.patch(f"/api/uploads/{created['id']}", json={"tmdb_id": 157336})

    fake_tracker_adapter = _FakeTrackerAdapter()
    fake_client_adapter = _FakeTorrentClientAdapter()
    monkeypatch.setattr(adapter_factory, "build_tracker_adapter", lambda tracker: fake_tracker_adapter)
    monkeypatch.setattr(adapter_factory, "build_torrent_client_adapter", lambda torrent_client: fake_client_adapter)

    session = _session(client)
    try:
        from app.models import TorrentClient

        torrent_client = TorrentClient(label="c", adapter_type="qbittorrent", base_url="https://c.example")
        session.add(torrent_client)
        session.commit()
        torrent_client_id = torrent_client.id
    finally:
        session.close()

    response = client.post(
        f"/api/uploads/{created['id']}/confirm", json={"torrent_client_id": torrent_client_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "uploaded"
    assert body["torrent_id_remote"] == "4242"
    assert len(fake_client_adapter.add_calls) == 1


def test_dupe_check_returns_candidates(client, tmp_path, monkeypatch):
    disk_id, tracker_id = _setup_disk_and_tracker(client, tmp_path)
    created = client.post(
        "/api/uploads",
        json={"disk_id": disk_id, "relative_path": "media/Movie.2024.1080p.WEB.mkv", "tracker_id": tracker_id},
    ).json()
    client.patch(f"/api/uploads/{created['id']}", json={"tmdb_id": 157336})

    candidate = TorrentCandidate(
        torrent_id_remote="1", info_hash=None, name="Existing.2024.mkv", size_bytes=123,
        file_list=None, mediainfo_unique_id=None,
    )
    monkeypatch.setattr(
        adapter_factory, "build_tracker_adapter", lambda tracker: _FakeTrackerAdapter(candidates=[candidate])
    )

    response = client.get(f"/api/uploads/{created['id']}/dupe-check")

    assert response.status_code == 200
    assert response.json() == [{"torrent_id_remote": "1", "name": "Existing.2024.mkv", "size_bytes": 123}]
