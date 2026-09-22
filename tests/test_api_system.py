import logging

import httpx

import app.api.system as system_module


def test_app_info(client):
    response = client.get("/api/system/info")
    assert response.status_code == 200
    body = response.json()
    assert body["version"]
    assert body["python_version"]
    assert "/" in body["platform"]
    assert body["started_at"]


def test_update_check_no_releases_yet(client, monkeypatch):
    def fake_get(url, headers=None, timeout=None):
        return httpx.Response(404, request=httpx.Request("GET", url))

    monkeypatch.setattr(system_module.httpx, "get", fake_get)

    response = client.get("/api/system/update-check")
    assert response.status_code == 200
    body = response.json()
    assert body["update_available"] is False
    assert body["latest_version"] is None
    assert "No releases" in body["note"]


def test_update_check_available(client, monkeypatch):
    def fake_get(url, headers=None, timeout=None):
        request = httpx.Request("GET", url)
        return httpx.Response(200, json={"tag_name": "v99.0.0"}, request=request)

    monkeypatch.setattr(system_module.httpx, "get", fake_get)

    response = client.get("/api/system/update-check")
    assert response.status_code == 200
    body = response.json()
    assert body["update_available"] is True
    assert body["latest_version"] == "v99.0.0"


def test_logs_filters_by_level(client):
    logging.getLogger("tests.system").info("an info line")
    logging.getLogger("tests.system").error("an error line")

    all_logs = client.get("/api/system/logs", params={"min_level": "DEBUG"}).json()
    assert all_logs["available"] is True
    messages = [e["message"] for e in all_logs["entries"]]
    assert "an info line" in messages
    assert "an error line" in messages

    errors_only = client.get("/api/system/logs", params={"min_level": "ERROR"}).json()
    messages = [e["message"] for e in errors_only["entries"]]
    assert "an info line" not in messages
    assert "an error line" in messages
