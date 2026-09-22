def test_available_mounts_lists_unassigned_subfolders(client):
    (client.scan_root / "disk1").mkdir()
    (client.scan_root / "disk2").mkdir()

    response = client.get("/api/disks/available-mounts")

    assert response.status_code == 200
    mounts = response.json()["mounts"]
    assert str(client.scan_root / "disk1") in mounts
    assert str(client.scan_root / "disk2") in mounts


def test_create_disk_then_disappears_from_available_mounts(client):
    (client.scan_root / "disk1").mkdir()

    create = client.post("/api/disks", json={"label": "Disk 1", "root_path": str(client.scan_root / "disk1")})
    assert create.status_code == 201
    disk_id = create.json()["id"]

    mounts = client.get("/api/disks/available-mounts").json()["mounts"]
    assert str(client.scan_root / "disk1") not in mounts

    listed = client.get("/api/disks").json()
    assert any(d["id"] == disk_id for d in listed)


def test_create_disk_rejects_path_outside_scan_root(client, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()

    response = client.post("/api/disks", json={"label": "Bad", "root_path": str(outside)})

    assert response.status_code == 400


def test_browse_rejects_path_traversal(client):
    (client.scan_root / "disk1").mkdir()
    create = client.post("/api/disks", json={"label": "Disk 1", "root_path": str(client.scan_root / "disk1")})
    disk_id = create.json()["id"]

    response = client.get(f"/api/disks/{disk_id}/browse", params={"path": "../../etc"})

    assert response.status_code == 400


def test_update_disk_torrent_client_root_path(client):
    (client.scan_root / "disk1").mkdir()
    created = client.post("/api/disks", json={"label": "Disk 1", "root_path": str(client.scan_root / "disk1")}).json()

    response = client.patch(f"/api/disks/{created['id']}", json={"torrent_client_root_path": "/mnt/disk1"})

    assert response.status_code == 200
    assert response.json()["torrent_client_root_path"] == "/mnt/disk1"


def test_update_disk_label(client):
    (client.scan_root / "disk1").mkdir()
    created = client.post("/api/disks", json={"label": "Disk 1", "root_path": str(client.scan_root / "disk1")}).json()

    response = client.patch(f"/api/disks/{created['id']}", json={"label": "Renamed"})

    assert response.status_code == 200
    assert response.json()["label"] == "Renamed"
