-- The Media Gauntlet*rr — schema DB
-- Vedi docs/SPEC.md per il razionale di ogni tabella/campo.
-- Eredita l'impostazione di ratio-guardian/docs/schema.sql, con una differenza
-- strutturale principale: qui il file fisico (media_file/seed_file) è
-- un'entità separata dall'identità logica (media_item) e dal record del
-- client torrent (client_torrent/client_torrent_file) — vedi SPEC.md §4 per
-- il perché e per come le FK vengono scritte (mai un join live su inode).

-- ============ CONFIGURAZIONE ============

CREATE TABLE IF NOT EXISTS disk (
    id                          INTEGER PRIMARY KEY,
    label                       TEXT NOT NULL,
    root_path                   TEXT NOT NULL UNIQUE,   -- deve combaciare/essere dentro un mount di config.yaml
    st_dev                      INTEGER,                -- cachato all'ultima verifica
    torrents_rel_path           TEXT,                   -- relativo a root_path, nullable
    torrent_client_root_path    TEXT,                   -- root di QUESTO disco vista dal client torrent, se diverso
                                                         -- da root_path (container/mount diversi per lo stesso disco
                                                         -- fisico) — nullo se client e Gauntletarr vedono lo
                                                         -- stesso path (caso comune, stesso host o stesso mount)
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_path (
    id                  INTEGER PRIMARY KEY,
    disk_id             INTEGER NOT NULL REFERENCES disk(id) ON DELETE CASCADE,
    relative_path       TEXT NOT NULL,          -- relativo a disk.root_path
    content_type        TEXT NOT NULL CHECK (content_type IN ('movie','tv')),
    enabled             BOOLEAN NOT NULL DEFAULT 1,
    new_torrent_rel_path TEXT,                  -- opzionale, relativo a disk.root_path (stessa
                                                 -- convenzione di disk.torrents_rel_path): SOLO dove
                                                 -- creare un NUOVO hardlink per questa libreria e quale
                                                 -- save_path comunicare al client. NON riduce la ricerca
                                                 -- "già in seeding", che resta sempre su tutta
                                                 -- disk.torrents_rel_path. Se nullo si usa
                                                 -- disk.torrents_rel_path invariato.
    UNIQUE(disk_id, relative_path)
);

CREATE TABLE IF NOT EXISTS tracker (
    id                      INTEGER PRIMARY KEY,
    label                   TEXT NOT NULL,
    adapter_type            TEXT NOT NULL,          -- "unit3d", futuri: "gazelle", ecc.
    base_url                TEXT NOT NULL,
    api_token               TEXT NOT NULL,          -- cifrato a riposo
    history_mode            TEXT NOT NULL DEFAULT 'unsupported'
                            CHECK (history_mode IN ('api','scrape','unsupported')),
    history_session_cookie  TEXT,                   -- se history_mode='scrape'
    rate_limit_per_min      INTEGER DEFAULT 30,
    enabled                 BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS torrent_client (
    id              INTEGER PRIMARY KEY,
    label           TEXT NOT NULL,
    adapter_type    TEXT NOT NULL,          -- "qbittorrent" | "deluge" | "transmission" | "rutorrent" | "qui"
                                             -- (multi-client fin dalla v1, vedi SPEC.md §5 — "qui" può
                                             -- risultare un semplice qbittorrent puntato altrove, punto
                                             -- ancora aperto)
    base_url        TEXT NOT NULL,
    username        TEXT,
    password        TEXT,                   -- cifrato a riposo
    enabled         BOOLEAN NOT NULL DEFAULT 1
);

-- Un disco può avere più client abilitati contemporaneamente (SPEC.md §5) —
-- serve una tabella ponte, non un FK singolo su disk.
CREATE TABLE IF NOT EXISTS disk_torrent_client (
    disk_id           INTEGER NOT NULL REFERENCES disk(id) ON DELETE CASCADE,
    torrent_client_id INTEGER NOT NULL REFERENCES torrent_client(id) ON DELETE CASCADE,
    PRIMARY KEY (disk_id, torrent_client_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
    -- es: confidence_threshold_auto_media_to_torrent=0.95,
    --     confidence_threshold_auto_torrent_to_client=0.98 (soglia più alta, vedi SPEC.md §3/§6 — valore
    --     di default indicativo, punto esplicitamente aperto in SPEC.md §15),
    --     schedule_cron="0 4 * * *"
);

-- ============ RUN LOG (prima del FISICO: media_file/seed_file/client_torrent_file
--   referenziano run_log.id in last_scan_id) ============

CREATE TABLE IF NOT EXISTS run_log (
    id                  INTEGER PRIMARY KEY,
    run_type            TEXT NOT NULL CHECK (run_type IN ('scheduled','manual','bulk_import')),
    started_at          TIMESTAMP NOT NULL,
    finished_at         TIMESTAMP,
    current_phase       TEXT CHECK (current_phase IN ('scanning','matching','executing')),  -- null = non in corso
    phase_total         INTEGER,          -- totale della fase corrente, per lo stato live (X/Y)
    phase_done          INTEGER,          -- fatti nella fase corrente
    items_total         INTEGER,          -- precontato all'avvio del run (totale scan)
    items_scanned       INTEGER DEFAULT 0,
    matches_found        INTEGER DEFAULT 0,
    auto_executed        INTEGER DEFAULT 0,   -- rinominato da auto_seeded: copre entrambe le direzioni
    pending_review       INTEGER DEFAULT 0,
    orphan_torrent_count  INTEGER DEFAULT 0,   -- nuovo KPI dashboard, SPEC.md §10
    ignored_count         INTEGER DEFAULT 0,   -- idem
    health_snapshot       REAL,                -- % "salute libreria" a fine run, per lo storico dashboard
                                                -- (SPEC.md §17, punto aperto — schema qui indicativo)
    errors                INTEGER DEFAULT 0
);

-- ============ FISICO (scritto SOLO dal processo di scan — mai a mano, mai da altre tabelle in lettura) ============

-- Identità logica del contenuto — separata dal file fisico (a differenza di
-- ratio-guardian) perché la vista a griglia (SPEC.md §7) deve raggruppare più
-- file fisici (episodi di una stagione, più versioni) sotto un solo poster.
CREATE TABLE IF NOT EXISTS media_item (
    id                  INTEGER PRIMARY KEY,
    content_type        TEXT NOT NULL CHECK (content_type IN ('movie','tv')),
    tmdb_id             INTEGER NOT NULL,
    season_number       INTEGER,                -- null per movie
    episode_number       INTEGER,                -- null per movie o season pack completo
    tmdb_poster_path    TEXT,                    -- path relativo TMDB; immagine cachata su filesystem
                                                  -- (data/posters/{tmdb_id}.jpg), mai in DB
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- SQLite tratta NULL come sempre diverso in UNIQUE: un vincolo unico diretto
-- su (tmdb_id, season_number, episode_number) NON impedirebbe due righe movie
-- duplicate (season/episode sempre null). Due indici parziali, uno per tipo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_item_movie ON media_item(tmdb_id)
    WHERE content_type = 'movie';
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_item_tv ON media_item(tmdb_id, season_number, episode_number)
    WHERE content_type = 'tv';

-- Fisico, lato media library. Una riga per file su disco sotto una media_path.
CREATE TABLE IF NOT EXISTS media_file (
    id                      INTEGER PRIMARY KEY,
    media_path_id           INTEGER NOT NULL REFERENCES media_path(id) ON DELETE CASCADE,
    disk_id                 INTEGER NOT NULL REFERENCES disk(id) ON DELETE CASCADE,   -- denormalizzato da media_path
                                                                                       -- per poter indicizzare
                                                                                       -- (disk_id, st_dev, inode)
                                                                                       -- senza un join in più
    relative_path           TEXT NOT NULL,          -- relativo a disk.root_path
    size_bytes              INTEGER NOT NULL,
    st_dev                  INTEGER NOT NULL,       -- "as of last scan" — mai attendibile oltre last_scan_id
    inode                   INTEGER NOT NULL,       -- idem — un inode viene riassegnato dal filesystem nel tempo
    nlink                   INTEGER,                -- >1 = hardlinkato da qualche parte, primo segnale rapido
    media_item_id           INTEGER REFERENCES media_item(id) ON DELETE SET NULL,     -- risolto dal resolver
    resolver_source         TEXT,                   -- "filename_parser" | "sonarr" | "radarr"
    mediainfo_unique_id     TEXT,                    -- calcolato on-demand, cachato
    last_scan_id            INTEGER NOT NULL REFERENCES run_log(id),
    last_seen_at            TIMESTAMP NOT NULL,
    UNIQUE(disk_id, relative_path)
);
CREATE INDEX IF NOT EXISTS idx_media_file_media_item_id ON media_file(media_item_id);
CREATE INDEX IF NOT EXISTS idx_media_file_hardlink ON media_file(disk_id, st_dev, inode);
    -- usato SOLO in scrittura, dal writer di fine-scan che popola seed_file.media_file_id — mai in lettura

-- Fisico, lato cartella torrent. Una riga per ogni hardlink sibling: un
-- contenuto cross-seedato su 3 torrent/tracker diversi produce 3 righe qui,
-- ciascuna con lo stesso (disk_id, st_dev, inode) ma path e
-- client_torrent_file diversi. Il cross-seed è quindi una query, non una
-- tabella dedicata (vedi SPEC.md §4).
CREATE TABLE IF NOT EXISTS seed_file (
    id              INTEGER PRIMARY KEY,
    disk_id         INTEGER NOT NULL REFERENCES disk(id) ON DELETE CASCADE,
    relative_path   TEXT NOT NULL,          -- relativo a disk.root_path
    size_bytes      INTEGER NOT NULL,
    st_dev          INTEGER NOT NULL,       -- "as of last scan"
    inode           INTEGER NOT NULL,       -- "as of last scan"
    media_file_id   INTEGER REFERENCES media_file(id) ON DELETE SET NULL,
        -- FK scritta SOLO dal bulk-upsert di fine scan (grouping per inode calcolato in memoria
        -- durante lo stesso os.walk, mai un self-join a runtime — vedi SPEC.md §4). Se più
        -- media_file condividono lo stesso inode (raro: hardlink duplicato dentro la libreria
        -- stessa), vince il primo trovato durante il walk, per coerenza con la stessa
        -- convenzione già usata da Auditorr per casi analoghi — gli altri restano comunque
        -- visibili interrogando media_file per (disk_id, st_dev, inode).
    last_scan_id    INTEGER NOT NULL REFERENCES run_log(id),
    last_seen_at    TIMESTAMP NOT NULL,     -- se più vecchio dell'ultimo run_log, la riga è stale:
                                             -- ancora mostrabile in UI (storico), mai usata per lo
                                             -- stato corrente (SPEC.md §3) finché non viene ri-confermata
    UNIQUE(disk_id, relative_path)
);
CREATE INDEX IF NOT EXISTS idx_seed_file_media_file_id ON seed_file(media_file_id);
CREATE INDEX IF NOT EXISTS idx_seed_file_hardlink ON seed_file(disk_id, st_dev, inode);
    -- usato SOLO in scrittura, stesso motivo di idx_media_file_hardlink

-- ============ CLIENT TORRENT (multi-istanza, SPEC.md §5) ============

-- Un torrent per UNA istanza client. Più righe per lo stesso contenuto
-- (client diversi, o stesso client con torrent diversi sullo stesso inode)
-- sono normali: è così che il cross-seed diventa visibile senza tabella dedicata.
CREATE TABLE IF NOT EXISTS client_torrent (
    id                  INTEGER PRIMARY KEY,
    torrent_client_id   INTEGER NOT NULL REFERENCES torrent_client(id) ON DELETE CASCADE,
    info_hash           TEXT NOT NULL,
    name                TEXT NOT NULL,
    save_path           TEXT NOT NULL,
    category            TEXT,
    tracker_url         TEXT,
    state               TEXT NOT NULL,          -- valore riportato dal client, non normalizzato qui
                                                 -- (mapping a stati Gauntletarr fatto in app, non in DB)
    added_at            TIMESTAMP,
    last_polled_at      TIMESTAMP NOT NULL,
    UNIQUE(torrent_client_id, info_hash)
);

-- Un file dentro un client_torrent, come lo riporta l'API del client.
CREATE TABLE IF NOT EXISTS client_torrent_file (
    id                  INTEGER PRIMARY KEY,
    client_torrent_id   INTEGER NOT NULL REFERENCES client_torrent(id) ON DELETE CASCADE,
    path_in_torrent     TEXT NOT NULL,          -- relativo a client_torrent.save_path
    size_bytes          INTEGER NOT NULL,
    seed_file_id         INTEGER REFERENCES seed_file(id) ON DELETE SET NULL,
        -- FK risolta per PATH (save_path + path_in_torrent confrontato contro disk.root_path +
        -- seed_file.relative_path), non per inode — più stabile di seed_file.media_file_id, ma
        -- comunque riverificata ad ogni scan (stesso last_scan_id) per coerenza.
    last_scan_id        INTEGER NOT NULL REFERENCES run_log(id)
);
CREATE INDEX IF NOT EXISTS idx_ctf_seed_file_id ON client_torrent_file(seed_file_id);
CREATE INDEX IF NOT EXISTS idx_ctf_client_torrent_id ON client_torrent_file(client_torrent_id);

-- ============ DOMINIO — matching e reseeding (SPEC.md §6-8) ============

CREATE TABLE IF NOT EXISTS candidate (
    id                   INTEGER PRIMARY KEY,
    media_item_id        INTEGER NOT NULL REFERENCES media_item(id) ON DELETE CASCADE,
    tracker_id           INTEGER NOT NULL REFERENCES tracker(id),
    torrent_id_remote    TEXT NOT NULL,          -- id sul tracker
    info_hash            TEXT,
    name                 TEXT NOT NULL,
    size_bytes           INTEGER NOT NULL,
    file_list_json       TEXT,                   -- se disponibile dall'API
    folder               TEXT,                   -- sottocartella del pack (UNIT3D "folder"), null per file singolo
    download_link        TEXT,                   -- URL autenticato al .torrent (necessario per add_torrent)
    source               TEXT NOT NULL CHECK (source IN ('history','catalog_search')),
    direction            TEXT NOT NULL CHECK (direction IN ('media_to_torrent','torrent_to_client')),
        -- quale delle due direzioni di SPEC.md §3 ha generato questo candidate — non presente in
        -- ratio-guardian, che conosceva solo media_to_torrent
    size_match           BOOLEAN,
    mediainfo_match       BOOLEAN,
    piece_verified        BOOLEAN,                -- esito verifica piece-hash (§6), null = non tentata
    piece_boundary_count  INTEGER,                -- piece a cavallo con un file adiacente nel torrent, non giudicabili
    confidence            REAL NOT NULL,          -- 0.0-1.0, calcolata da regole esplicite
    ambiguity_reason      TEXT,                   -- es. "season_pack_partial", "multiple_size_matches", "piece_mismatch"
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_review (
    id              INTEGER PRIMARY KEY,
    candidate_id    INTEGER NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','auto_approved')),
    decided_by      TEXT,                   -- "system" | username
    decided_at      TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seed_job (
    id                          INTEGER PRIMARY KEY,
    candidate_id                INTEGER NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
    source_media_file_id        INTEGER REFERENCES media_file(id),
        -- valorizzato per direction='media_to_torrent': il file locale da cui si crea l'hardlink
    source_seed_file_id         INTEGER REFERENCES seed_file(id),
        -- valorizzato per direction='torrent_to_client': il file già presente da collegare al client
    result_seed_file_id         INTEGER REFERENCES seed_file(id),
        -- l'hardlink creato (media_to_torrent) o il seed_file confermato (torrent_to_client) —
        -- noto solo a esecuzione riuscita, riempito dal prossimo scan che lo rileva
    result_client_torrent_id    INTEGER REFERENCES client_torrent(id),
        -- noto solo dopo l'aggiunta al client e il prossimo poll — mai al momento della add_torrent
    hardlink_created_at         TIMESTAMP,
    torrent_added_at            TIMESTAMP,
    recheck_status               TEXT CHECK (recheck_status IN ('pending','ok','failed')),
    final_status                 TEXT NOT NULL DEFAULT 'in_progress'
                                 CHECK (final_status IN ('in_progress','seeding','failed','rolled_back')),
    error_message                TEXT
    -- Layout indicativo — dettagli di esecuzione da rifinire in Fase 4 (docs/ROADMAP.md), in
    -- particolare come/quando result_seed_file_id e result_client_torrent_id vengono riconciliati
    -- col prossimo scan invece che scritti direttamente dall'esecutore.
);

-- ============ UPLOAD (SPEC.md §9) ============

CREATE TABLE IF NOT EXISTS tracker_upload_profile (
    tracker_id              INTEGER PRIMARY KEY REFERENCES tracker(id) ON DELETE CASCADE,
    category_id_map_json    TEXT,           -- {"movie": 1, "tv": 2}, valori reali da verificare per tracker
    type_id_map_json        TEXT,           -- {"REMUX": 20, "WEBDL": 21, ...}
    resolution_id_map_json  TEXT,
    naming_convention       TEXT,           -- template nome release, TBD in Fase 6
    description_template    TEXT,           -- Jinja2
    default_anonymous       BOOLEAN NOT NULL DEFAULT 0,
    default_personal_release BOOLEAN NOT NULL DEFAULT 0,
    source_profile_key      TEXT            -- file bundlato da cui è stato copiato alla creazione (es. "itt"),
                                             -- solo per riferimento — mai riletto a runtime dopo la copia
);

CREATE TABLE IF NOT EXISTS upload_job (
    id                      INTEGER PRIMARY KEY,
    media_file_id           INTEGER REFERENCES media_file(id),
        -- nullable: il file può non essere mai passato dallo scan esistente (selezione diretta da file browser)
    source_path             TEXT NOT NULL,   -- path assoluto scelto, indipendentemente da media_file_id
    tracker_id              INTEGER NOT NULL REFERENCES tracker(id),
    status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','ready','uploading','uploaded','failed')),
    torrent_path            TEXT,            -- .torrent creato localmente (torf)
    info_hash               TEXT,
    mediainfo_text           TEXT,
    screenshot_urls_json      TEXT,           -- lista di URL pubblici (ImageHostAdapter)
    description_rendered      TEXT,
    tmdb_id                  INTEGER,
    imdb_id                  TEXT,
    category_id               INTEGER,        -- risolto dal profilo, modificabile prima dell'invio
    type_id                   INTEGER,
    resolution_id              INTEGER,
    torrent_id_remote          TEXT,           -- esito, noto solo a upload riuscito
    error_message               TEXT,
    created_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici sulle foreign key più interrogate (SQLite non le indicizza da
-- solo): senza questi, i conteggi della dashboard (join/exists su
-- candidate/seed_job) possono rallentare parecchio non appena quelle
-- tabelle crescono, specie in concorrenza con le scritture di una run.
CREATE INDEX IF NOT EXISTS idx_candidate_media_item_id ON candidate(media_item_id);
CREATE INDEX IF NOT EXISTS idx_candidate_tracker_id ON candidate(tracker_id);
CREATE INDEX IF NOT EXISTS idx_match_review_candidate_id ON match_review(candidate_id);
CREATE INDEX IF NOT EXISTS idx_seed_job_candidate_id ON seed_job(candidate_id);
CREATE INDEX IF NOT EXISTS idx_seed_job_source_media_file_id ON seed_job(source_media_file_id);
CREATE INDEX IF NOT EXISTS idx_seed_job_source_seed_file_id ON seed_job(source_seed_file_id);
CREATE INDEX IF NOT EXISTS idx_upload_job_tracker_id ON upload_job(tracker_id);
