def test_create_list_update_delete_tracker(client):
    create = client.post(
        "/api/trackers",
        json={"label": "ITT", "adapter_type": "unit3d", "base_url": "https://itt.example", "api_token": "secret"},
    )
    assert create.status_code == 201
    tracker_id = create.json()["id"]
    assert "api_token" not in create.json()  # mai esposto in risposta

    listed = client.get("/api/trackers").json()
    assert any(t["id"] == tracker_id for t in listed)

    update = client.patch(f"/api/trackers/{tracker_id}", json={"enabled": False})
    assert update.status_code == 200
    assert update.json()["enabled"] is False

    delete = client.delete(f"/api/trackers/{tracker_id}")
    assert delete.status_code == 204
    assert client.get("/api/trackers").json() == []


def test_rejects_unsupported_adapter_type(client):
    response = client.post(
        "/api/trackers",
        json={"label": "x", "adapter_type": "gazelle", "base_url": "https://x.example", "api_token": "t"},
    )
    assert response.status_code == 400


def test_tracker_client_can_be_set_and_cleared(client):
    created = client.post("/api/trackers", json={
        "label": "ITT", "adapter_type": "unit3d", "base_url": "https://t.example", "api_token": "x",
        "torrent_client_id": 3,
    }).json()
    assert created["torrent_client_id"] == 3

    kept = client.patch(f"/api/trackers/{created['id']}", json={"label": "ITT 2"}).json()
    assert kept["torrent_client_id"] == 3
    cleared = client.patch(f"/api/trackers/{created['id']}", json={"torrent_client_id": None}).json()
    assert cleared["torrent_client_id"] is None
