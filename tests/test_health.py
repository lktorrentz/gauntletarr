"""Fase 0 — smoke test: il container si avvia, legge config.yaml, applica
lo schema DB e risponde su /api/health (definition of done, docs/ROADMAP.md)."""

from fastapi.testclient import TestClient


def test_health(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    config_path = tmp_path / "config.yaml"
    config_path.write_text(f"disk_scan_root: {tmp_path}\ndata_dir: {data_dir}\n")
    monkeypatch.setenv("CONFIG_PATH", str(config_path))

    from app.main import app

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert (data_dir / "gauntletarr.db").exists()
