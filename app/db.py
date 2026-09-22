"""Engine SQLAlchemy + applicazione dello schema.

Convenzione del progetto (docs/ROADMAP.md, Fase 0): docs/schema.sql è la
fonte di verità per la DDL. Non usiamo Base.metadata.create_all() per non
duplicare/divergere dallo schema: allo startup eseguiamo schema.sql
direttamente (le CREATE TABLE sono idempotenti, IF NOT EXISTS) — comprese
le tabelle non ancora usate dall'app in questa fase (matching/upload
arrivano rispettivamente in Fase 4 e Fase 6, ma le loro tabelle esistono
già da subito, vuote, senza bisogno di un secondo schema). I modelli in
app/models.py mappano via ORM solo le tabelle già rilevanti per la fase
corrente, e crescono di pari passo con le fasi successive.

CREATE TABLE IF NOT EXISTS crea le tabelle mancanti ma non tocca quelle
già esistenti: una colonna additiva aggiunta a un modello dopo che un
utente ha già un DB reale non comparirebbe mai sul suo DB solo con
apply_schema(). migrate_schema() colma questo gap confrontando le colonne
attese (dai modelli SQLAlchemy) con quelle realmente presenti e
aggiungendo quelle mancanti via ALTER TABLE — va chiamata sempre, ad ogni
avvio, dopo apply_schema(). Stesso pattern di ratio-guardian/app/db.py.

migrate_legacy_media_path_id() copre l'unico caso finora in cui questo
schema è cambiato in un modo che apply_schema()/migrate_schema() non
sanno gestire: il commit 5fd42fc ha eliminato la tabella media_path e la
sua FK NOT NULL media_file.media_path_id, sostituendole con
disk.media_rel_path. Un DB creato PRIMA di quel commit conserva ancora
la vecchia forma (la CREATE TABLE IF NOT EXISTS di apply_schema non
tocca una tabella già esistente, e migrate_schema sa solo aggiungere
colonne, mai rimuoverle) — ogni scan da allora falliva silenziosamente
al primo INSERT in media_file, perché il codice attuale non valorizza
più quella colonna (bug riportato dall'utente sulla sua istanza Unraid
reale, con dati che NON si possono semplicemente ricreare da zero come
si è sempre fatto finora per un'istanza di sviluppo)."""

import logging
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "docs" / "schema.sql"


@event.listens_for(Engine, "connect")
def _configure_sqlite(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    # WAL invece del rollback journal di default: i lettori (es. il
    # polling dello stato live di una run, a partire dalla Fase 5) non
    # vengono bloccati da uno scrittore concorrente (lo scan in corso).
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


def make_engine(db_path: str) -> Engine:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})


def migrate_legacy_media_path_id(engine: Engine) -> None:
    """Ricostruisce media_file senza la colonna legacy media_path_id, se
    presente — vedi la nota in cima al file. Va chiamata PRIMA di
    apply_schema(): quest'ultima non ricrea mai una tabella già esistente,
    quindi deve trovare media_file già rinominata via ALTER TABLE ... RENAME
    per poter ricreare quella corretta con CREATE TABLE IF NOT EXISTS.

    PRAGMA foreign_keys=OFF per tutta la durata: SQLite riscrive
    automaticamente le REFERENCES di altre tabelle verso una tabella
    rinominata SOLO quando le foreign key sono attive. Con le FK spente, il
    RENAME sotto lascia intatto il testo "REFERENCES media_file(id)" in
    seed_file/match_review/upload_job, che dopo la ricostruzione torna a
    puntare correttamente alla nuova media_file (stessi id delle righe
    originali, copiati esplicitamente) — nessuna di quelle tabelle va
    toccata."""
    inspector = inspect(engine)
    if not inspector.has_table("media_file"):
        return
    existing_columns = {col["name"] for col in inspector.get_columns("media_file")}
    if "media_path_id" not in existing_columns:
        return

    logger.warning(
        "Migrazione legacy: media_file.media_path_id (pre-5fd42fc) rimosso, "
        "dati preservati con gli stessi id"
    )
    raw_conn = engine.raw_connection()
    try:
        raw_conn.executescript("""
            PRAGMA foreign_keys=OFF;
            ALTER TABLE media_file RENAME TO media_file_legacy;
            CREATE TABLE media_file (
                id                      INTEGER PRIMARY KEY,
                disk_id                 INTEGER NOT NULL REFERENCES disk(id) ON DELETE CASCADE,
                relative_path           TEXT NOT NULL,
                size_bytes              INTEGER NOT NULL,
                st_dev                  INTEGER NOT NULL,
                inode                   INTEGER NOT NULL,
                nlink                   INTEGER,
                content_hash            TEXT,
                media_item_id           INTEGER REFERENCES media_item(id) ON DELETE SET NULL,
                resolver_source         TEXT,
                mediainfo_unique_id     TEXT,
                last_scan_id            INTEGER NOT NULL REFERENCES run_log(id),
                last_seen_at            TIMESTAMP NOT NULL,
                UNIQUE(disk_id, relative_path)
            );
            INSERT INTO media_file (
                id, disk_id, relative_path, size_bytes, st_dev, inode, nlink,
                content_hash, media_item_id, resolver_source, mediainfo_unique_id,
                last_scan_id, last_seen_at
            )
            SELECT
                id, disk_id, relative_path, size_bytes, st_dev, inode, nlink,
                content_hash, media_item_id, resolver_source, mediainfo_unique_id,
                last_scan_id, last_seen_at
            FROM media_file_legacy;
            DROP TABLE media_file_legacy;
            DROP TABLE IF EXISTS media_path;
            CREATE INDEX IF NOT EXISTS idx_media_file_media_item_id ON media_file(media_item_id);
            CREATE INDEX IF NOT EXISTS idx_media_file_hardlink ON media_file(disk_id, st_dev, inode);
            PRAGMA foreign_keys=ON;
        """)
        raw_conn.commit()
    finally:
        raw_conn.close()


def apply_schema(engine: Engine, schema_path: Path = SCHEMA_PATH) -> None:
    schema_sql = schema_path.read_text()
    raw_conn = engine.raw_connection()
    try:
        raw_conn.executescript(schema_sql)
        raw_conn.commit()
    finally:
        raw_conn.close()


def migrate_schema(engine: Engine) -> None:
    """Aggiunge alle tabelle già esistenti le colonne presenti nei modelli
    ma non ancora nel DB reale (vedi nota in cima al file). Gestisce solo
    aggiunte additive di colonne nullable senza server_default — l'unico
    tipo di modifica che questo progetto si è finora impegnato a fare."""
    from app.models import Base  # import qui: evita un ciclo db<->models

    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue  # tabella nuova: apply_schema l'ha già creata per intero
            existing_columns = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                col_type = column.type.compile(dialect=conn.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'))


def make_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
