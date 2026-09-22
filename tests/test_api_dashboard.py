def test_dashboard_empty_library(client):
    response = client.get("/api/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["health_pct"] == 100.0
    assert body["last_run"] is None
    assert body["pending_review"] == 0


def test_dashboard_history_empty(client):
    response = client.get("/api/dashboard/history")

    assert response.status_code == 200
    assert response.json() == []


def test_dashboard_whats_new_empty(client):
    response = client.get("/api/dashboard/whats-new")

    assert response.status_code == 200
    assert response.json() == []


def test_dashboard_reflects_run_log(client):
    session = client.app.state.session_factory()
    try:
        from app import pipeline

        run = pipeline.start_run(session, "bulk_import")
        run.current_phase = None
        run.finished_at = run.started_at
        run.items_scanned = 5
        run.matches_found = 2
        run.auto_executed = 1
        run.pending_review = 1
        run.health_snapshot = 80.0
        session.commit()
    finally:
        session.close()

    dashboard = client.get("/api/dashboard").json()
    assert dashboard["last_run"]["items_scanned"] == 5
    assert dashboard["last_run"]["matches_found"] == 2

    history = client.get("/api/dashboard/history").json()
    assert len(history) == 1
    assert history[0]["health_snapshot"] == 80.0
    assert history[0]["items_scanned"] == 5
    assert history[0]["matches_found"] == 2
    assert history[0]["auto_executed"] == 1
    assert history[0]["pending_review"] == 1
    assert history[0]["errors"] == 0


def test_schedule_defaults_to_disabled(client):
    response = client.get("/api/schedule")

    assert response.status_code == 200
    assert response.json() == {"cron": None, "enabled": False}


def test_schedule_put_valid_cron_enables_and_persists(client):
    response = client.put("/api/schedule", json={"cron": "0 3 * * *"})

    assert response.status_code == 200
    assert response.json() == {"cron": "0 3 * * *", "enabled": True}
    assert client.get("/api/schedule").json()["enabled"] is True
    assert client.app.state.scheduler.get_job("scheduled_run") is not None


def test_schedule_put_invalid_cron_rejected(client):
    response = client.put("/api/schedule", json={"cron": "not a cron expression"})

    assert response.status_code == 422
    assert client.get("/api/schedule").json()["enabled"] is False


def test_schedule_put_empty_disables(client):
    client.put("/api/schedule", json={"cron": "0 3 * * *"})

    response = client.put("/api/schedule", json={"cron": ""})

    assert response.status_code == 200
    assert response.json() == {"cron": None, "enabled": False}
    assert client.app.state.scheduler.get_job("scheduled_run") is None
