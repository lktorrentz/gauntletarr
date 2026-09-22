def test_get_unset_setting_returns_null_value(client):
    response = client.get("/api/settings/tmdb_api_key")

    assert response.status_code == 200
    assert response.json() == {"key": "tmdb_api_key", "value": None}


def test_set_then_get_setting(client):
    put = client.put("/api/settings/tmdb_api_key", json={"value": "abc123"})
    assert put.status_code == 200
    assert put.json() == {"key": "tmdb_api_key", "value": "abc123"}

    get = client.get("/api/settings/tmdb_api_key")
    assert get.json() == {"key": "tmdb_api_key", "value": "abc123"}


def test_set_overwrites_previous_value(client):
    client.put("/api/settings/tmdb_api_key", json={"value": "first"})
    client.put("/api/settings/tmdb_api_key", json={"value": "second"})

    response = client.get("/api/settings/tmdb_api_key")
    assert response.json()["value"] == "second"


def test_exclusion_presets_available_lists_known_presets(client):
    response = client.get("/api/settings/exclusion-presets/available")
    assert response.status_code == 200
    keys = {p["key"] for p in response.json()}
    assert {"scene_junk", "qbittorrent_incomplete", "utorrent_incomplete", "bitcomet_incomplete"} <= keys
