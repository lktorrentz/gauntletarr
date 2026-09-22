def _create_disk(client, label="Disk 1"):
    disk_dir = client.scan_root / label.replace(" ", "_")
    disk_dir.mkdir()
    response = client.post("/api/disks", json={"label": label, "root_path": str(disk_dir)})
    return response.json()["id"], disk_dir


def test_create_media_path(client):
    disk_id, disk_dir = _create_disk(client)
    (disk_dir / "movies").mkdir()

    response = client.post(
        f"/api/disks/{disk_id}/media-paths", json={"relative_path": "movies", "content_type": "movie"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["relative_path"] == "movies"
    assert body["content_type"] == "movie"
    assert body["enabled"] is True


def test_create_media_path_rejects_missing_folder(client):
    disk_id, _disk_dir = _create_disk(client)

    response = client.post(
        f"/api/disks/{disk_id}/media-paths", json={"relative_path": "missing", "content_type": "movie"}
    )

    assert response.status_code == 400


def test_create_media_path_rejects_invalid_content_type(client):
    disk_id, disk_dir = _create_disk(client)
    (disk_dir / "movies").mkdir()

    response = client.post(
        f"/api/disks/{disk_id}/media-paths", json={"relative_path": "movies", "content_type": "music"}
    )

    assert response.status_code == 400


def test_update_media_path_content_type(client):
    disk_id, disk_dir = _create_disk(client)
    (disk_dir / "shows").mkdir()
    created = client.post(
        f"/api/disks/{disk_id}/media-paths", json={"relative_path": "shows", "content_type": "movie"}
    ).json()

    response = client.patch(f"/api/media-paths/{created['id']}", json={"content_type": "tv"})

    assert response.status_code == 200
    assert response.json()["content_type"] == "tv"


def test_update_media_path_relative_path(client):
    disk_id, disk_dir = _create_disk(client)
    (disk_dir / "old").mkdir()
    (disk_dir / "new").mkdir()
    created = client.post(
        f"/api/disks/{disk_id}/media-paths", json={"relative_path": "old", "content_type": "movie"}
    ).json()

    response = client.patch(f"/api/media-paths/{created['id']}", json={"relative_path": "new"})

    assert response.status_code == 200
    assert response.json()["relative_path"] == "new"


def test_update_media_path_rejects_missing_folder(client):
    disk_id, disk_dir = _create_disk(client)
    (disk_dir / "movies").mkdir()
    created = client.post(
        f"/api/disks/{disk_id}/media-paths", json={"relative_path": "movies", "content_type": "movie"}
    ).json()

    response = client.patch(f"/api/media-paths/{created['id']}", json={"relative_path": "nope"})

    assert response.status_code == 400


def test_update_media_path_rejects_invalid_content_type(client):
    disk_id, disk_dir = _create_disk(client)
    (disk_dir / "movies").mkdir()
    created = client.post(
        f"/api/disks/{disk_id}/media-paths", json={"relative_path": "movies", "content_type": "movie"}
    ).json()

    response = client.patch(f"/api/media-paths/{created['id']}", json={"content_type": "music"})

    assert response.status_code == 400


def test_update_media_path_enabled(client):
    disk_id, disk_dir = _create_disk(client)
    (disk_dir / "movies").mkdir()
    created = client.post(
        f"/api/disks/{disk_id}/media-paths", json={"relative_path": "movies", "content_type": "movie"}
    ).json()

    response = client.patch(f"/api/media-paths/{created['id']}", json={"enabled": False})

    assert response.status_code == 200
    assert response.json()["enabled"] is False


def test_delete_media_path(client):
    disk_id, disk_dir = _create_disk(client)
    (disk_dir / "movies").mkdir()
    created = client.post(
        f"/api/disks/{disk_id}/media-paths", json={"relative_path": "movies", "content_type": "movie"}
    ).json()

    response = client.delete(f"/api/media-paths/{created['id']}")
    assert response.status_code == 204

    listed = client.get(f"/api/disks/{disk_id}/media-paths").json()
    assert listed == []
