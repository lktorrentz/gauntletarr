"""Fase 0 — smoke test: il container si avvia, legge config.yaml, applica
lo schema DB e risponde su /api/health (definition of done, docs/ROADMAP.md)."""


def test_health(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert (client.scan_root.parent / "data" / "gauntletarr.db").exists()
