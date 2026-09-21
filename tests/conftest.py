import pytest
from fastapi.testclient import TestClient

from app import db as db_module


@pytest.fixture
def db_session(tmp_path):
    engine = db_module.make_engine(str(tmp_path / "test.db"))
    db_module.apply_schema(engine)
    db_module.migrate_schema(engine)
    session_factory = db_module.make_session_factory(engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    scan_root = tmp_path / "mnt"
    scan_root.mkdir()
    config_path = tmp_path / "config.yaml"
    config_path.write_text(f"disk_scan_root: {scan_root}\ndata_dir: {data_dir}\n")
    monkeypatch.setenv("CONFIG_PATH", str(config_path))

    from app.main import app

    with TestClient(app) as test_client:
        test_client.scan_root = scan_root  # comodo per i test: root disponibile senza rileggere il config
        yield test_client
