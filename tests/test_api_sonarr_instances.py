def test_create_list_update_delete_sonarr_instance(client):
    create = client.post(
        "/api/sonarr-instances",
        json={"label": "Main Sonarr", "base_url": "http://sonarr:8989", "api_key": "secret"},
    )
    assert create.status_code == 201
    instance_id = create.json()["id"]
    assert "api_key" not in create.json()  # mai esposto in risposta

    listed = client.get("/api/sonarr-instances").json()
    assert any(i["id"] == instance_id for i in listed)

    update = client.patch(f"/api/sonarr-instances/{instance_id}", json={"enabled": False})
    assert update.status_code == 200
    assert update.json()["enabled"] is False

    delete = client.delete(f"/api/sonarr-instances/{instance_id}")
    assert delete.status_code == 204
    assert client.get("/api/sonarr-instances").json() == []


def test_supports_multiple_instances(client):
    client.post(
        "/api/sonarr-instances", json={"label": "Anime", "base_url": "http://sonarr-anime:8989", "api_key": "a"}
    )
    client.post("/api/sonarr-instances", json={"label": "TV", "base_url": "http://sonarr-tv:8989", "api_key": "b"})

    listed = client.get("/api/sonarr-instances").json()
    assert {i["label"] for i in listed} == {"Anime", "TV"}


def test_get_sonarr_instance_not_found_returns_coded_error(client):
    response = client.patch("/api/sonarr-instances/999999", json={"label": "x"})
    assert response.status_code == 404
    assert response.json()["detail"] == {"code": "sonarr_instance_not_found", "params": {"id": 999999}}
