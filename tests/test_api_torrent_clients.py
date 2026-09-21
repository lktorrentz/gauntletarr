def test_create_list_update_delete_torrent_client(client):
    create = client.post(
        "/api/torrent-clients",
        json={"label": "qbt", "adapter_type": "qbittorrent", "base_url": "http://qbt:8080", "username": "admin"},
    )
    assert create.status_code == 201
    tc_id = create.json()["id"]
    assert create.json()["enabled"] is True

    listed = client.get("/api/torrent-clients").json()
    assert any(tc["id"] == tc_id for tc in listed)

    update = client.patch(f"/api/torrent-clients/{tc_id}", json={"enabled": False})
    assert update.status_code == 200
    assert update.json()["enabled"] is False

    delete = client.delete(f"/api/torrent-clients/{tc_id}")
    assert delete.status_code == 204
    assert client.get("/api/torrent-clients").json() == []


def test_rejects_unsupported_adapter_type(client):
    response = client.post(
        "/api/torrent-clients",
        json={"label": "deluge", "adapter_type": "deluge", "base_url": "http://deluge:8112"},
    )
    assert response.status_code == 400


def test_associate_and_dissociate_disk(client):
    (client.scan_root / "disk1").mkdir()
    disk_create = client.post("/api/disks", json={"label": "Disk 1", "root_path": str(client.scan_root / "disk1")})
    disk_id = disk_create.json()["id"]
    tc_id = client.post(
        "/api/torrent-clients", json={"label": "qbt", "adapter_type": "qbittorrent", "base_url": "http://qbt"}
    ).json()["id"]

    associate = client.post(f"/api/torrent-clients/{tc_id}/disks/{disk_id}")
    assert associate.status_code == 204

    # idempotente: associare due volte non deve fallire né duplicare
    again = client.post(f"/api/torrent-clients/{tc_id}/disks/{disk_id}")
    assert again.status_code == 204

    dissociate = client.delete(f"/api/torrent-clients/{tc_id}/disks/{disk_id}")
    assert dissociate.status_code == 204
