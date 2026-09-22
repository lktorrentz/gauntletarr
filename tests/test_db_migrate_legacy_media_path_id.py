"""Copre il bug riportato dall'utente sulla sua istanza Unraid reale: un DB
creato prima del commit 5fd42fc ha ancora la vecchia tabella media_file con
media_path_id NOT NULL (FK verso la media_path ormai rimossa dallo schema
corrente) — ogni scan falliva al primo INSERT perché il codice attuale non
valorizza più quella colonna. db.migrate_legacy_media_path_id() deve
ricostruire media_file senza quella colonna, preservando gli id (da cui
dipendono seed_file/match_review/upload_job) e i dati già presenti."""

from sqlalchemy import inspect, text

from app import db as db_module

LEGACY_SCHEMA = """
CREATE TABLE disk (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    root_path TEXT NOT NULL UNIQUE,
    st_dev INTEGER,
    torrents_rel_path TEXT,
    torrent_client_root_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE media_path (
    id INTEGER PRIMARY KEY,
    disk_id INTEGER NOT NULL REFERENCES disk(id) ON DELETE CASCADE,
    relative_path TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('movie','tv')),
    enabled BOOLEAN NOT NULL DEFAULT 1,
    new_torrent_rel_path TEXT,
    UNIQUE(disk_id, relative_path)
);

CREATE TABLE run_log (
    id INTEGER PRIMARY KEY,
    run_type TEXT NOT NULL,
    started_at TIMESTAMP NOT NULL
);

CREATE TABLE media_item (
    id INTEGER PRIMARY KEY,
    content_type TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL
);

CREATE TABLE media_file (
    id INTEGER PRIMARY KEY,
    media_path_id INTEGER NOT NULL REFERENCES media_path(id) ON DELETE CASCADE,
    disk_id INTEGER NOT NULL REFERENCES disk(id) ON DELETE CASCADE,
    relative_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    st_dev INTEGER NOT NULL,
    inode INTEGER NOT NULL,
    nlink INTEGER,
    content_hash TEXT,
    media_item_id INTEGER REFERENCES media_item(id) ON DELETE SET NULL,
    resolver_source TEXT,
    mediainfo_unique_id TEXT,
    last_scan_id INTEGER NOT NULL REFERENCES run_log(id),
    last_seen_at TIMESTAMP NOT NULL,
    UNIQUE(disk_id, relative_path)
);

CREATE TABLE seed_file (
    id INTEGER PRIMARY KEY,
    disk_id INTEGER NOT NULL REFERENCES disk(id) ON DELETE CASCADE,
    relative_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    st_dev INTEGER NOT NULL,
    inode INTEGER NOT NULL,
    media_file_id INTEGER REFERENCES media_file(id) ON DELETE SET NULL,
    last_scan_id INTEGER NOT NULL REFERENCES run_log(id),
    last_seen_at TIMESTAMP NOT NULL,
    UNIQUE(disk_id, relative_path)
);
"""


def _seed_legacy_db(engine):
    raw_conn = engine.raw_connection()
    try:
        raw_conn.executescript(LEGACY_SCHEMA)
        raw_conn.executescript("""
            INSERT INTO disk (id, label, root_path) VALUES (1, 'Data', '/data');
            INSERT INTO media_path (id, disk_id, relative_path, content_type)
                VALUES (1, 1, 'media/tv', 'tv');
            INSERT INTO run_log (id, run_type, started_at)
                VALUES (1, 'manual', '2026-09-22T20:00:00');
            INSERT INTO media_file (
                id, media_path_id, disk_id, relative_path, size_bytes, st_dev, inode,
                last_scan_id, last_seen_at
            ) VALUES (
                42, 1, 1, 'media/tv/Show/S01E01.mkv', 12345, 55, 999,
                1, '2026-09-22T20:00:00'
            );
            INSERT INTO seed_file (
                id, disk_id, relative_path, size_bytes, st_dev, inode, media_file_id,
                last_scan_id, last_seen_at
            ) VALUES (
                7, 1, 'torrents/Show/S01E01.mkv', 12345, 55, 999, 42,
                1, '2026-09-22T20:00:00'
            );
        """)
        raw_conn.commit()
    finally:
        raw_conn.close()


def test_migrate_legacy_media_path_id_preserves_data_and_ids(tmp_path):
    engine = db_module.make_engine(str(tmp_path / "legacy.db"))
    _seed_legacy_db(engine)

    db_module.migrate_legacy_media_path_id(engine)

    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns("media_file")}
    assert "media_path_id" not in columns
    assert not inspector.has_table("media_path")

    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id, disk_id, relative_path, size_bytes FROM media_file WHERE id = 42")
        ).one()
        assert row == (42, 1, "media/tv/Show/S01E01.mkv", 12345)

        # La FK di seed_file verso media_file non deve essersi rotta: stesso id,
        # stessa tabella (rinominata, poi ricreata con lo stesso nome).
        seed_row = conn.execute(text("SELECT media_file_id FROM seed_file WHERE id = 7")).one()
        assert seed_row == (42,)


def test_migrate_legacy_media_path_id_allows_insert_without_the_column(tmp_path):
    engine = db_module.make_engine(str(tmp_path / "legacy.db"))
    _seed_legacy_db(engine)
    db_module.migrate_legacy_media_path_id(engine)

    # Lo stesso INSERT che app/db_utils.py::bulk_upsert emette per uno scan
    # reale (app/scanner.py) — mai valorizza media_path_id, che prima di
    # questa migrazione avrebbe fatto fallire ogni scan con
    # "NOT NULL constraint failed: media_file.media_path_id".
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO media_file "
                "(disk_id, relative_path, size_bytes, st_dev, inode, last_scan_id, last_seen_at) "
                "VALUES (1, 'media/tv/Show/S01E02.mkv', 999, 55, 1000, 1, '2026-09-22T20:00:00')"
            )
        )


def test_migrate_legacy_media_path_id_is_a_noop_on_current_schema(tmp_path):
    engine = db_module.make_engine(str(tmp_path / "current.db"))
    db_module.migrate_legacy_media_path_id(engine)  # DB vuoto: nessuna tabella media_file, nessun errore
    db_module.apply_schema(engine)
    db_module.migrate_schema(engine)

    # Rilanciarla su uno schema già corrente non deve toccare nulla né rompersi.
    db_module.migrate_legacy_media_path_id(engine)
    inspector = inspect(engine)
    assert inspector.has_table("media_file")
    columns = {col["name"] for col in inspector.get_columns("media_file")}
    assert "media_path_id" not in columns
