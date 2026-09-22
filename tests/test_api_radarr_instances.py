def test_create_list_update_delete_radarr_instance(client):
    create = client.post(
        "/api/radarr-instances",
        json={"label": "Main Radarr", "base_url": "http://radarr:7878", "api_key": "secret"},
    )
    assert create.status_code == 201
    instance_id = create.json()["id"]
    assert "api_key" not in create.json()  # mai esposto in risposta

    listed = client.get("/api/radarr-instances").json()
    assert any(i["id"] == instance_id for i in listed)

    update = client.patch(f"/api/radarr-instances/{instance_id}", json={"enabled": False})
    assert update.status_code == 200
    assert update.json()["enabled"] is False

    delete = client.delete(f"/api/radarr-instances/{instance_id}")
    assert delete.status_code == 204
    assert client.get("/api/radarr-instances").json() == []


def test_supports_multiple_instances(client):
    client.post("/api/radarr-instances", json={"label": "4K", "base_url": "http://radarr-4k:7878", "api_key": "a"})
    client.post("/api/radarr-instances", json={"label": "SD", "base_url": "http://radarr-sd:7878", "api_key": "b"})

    listed = client.get("/api/radarr-instances").json()
    assert {i["label"] for i in listed} == {"4K", "SD"}


def test_get_radarr_instance_not_found_returns_coded_error(client):
    response = client.patch("/api/radarr-instances/999999", json={"label": "x"})
    assert response.status_code == 404
    assert response.json()["detail"] == {"code": "radarr_instance_not_found", "params": {"id": 999999}}
