# Roadmap a fasi — The Media Gauntlet*rr

Ogni fase corrisponde grosso modo al completamento di una Media Stone (vedi `docs/SPEC.md`, sezione "Tema: le Media Stones"), più una fase 0 di fondamenta e una fase 7 di chiusura per il rilascio open source. Le fasi sono sequenziali per dipendenza logica (non è utile costruire il motore di matching prima che esistano gli adapter client e il resolver media che consuma), ma **non vanno intese come sprint a tempo fisso** — ciascuna si chiude quando la sua definition of done è soddisfatta, non a una scadenza.

Riferimenti di sezione sempre a `docs/SPEC.md`.

---

## Fase 0 — Fondamenta (nessuna Stone)

**Obiettivo**: scheletro del progetto su cui si innestano tutte le fasi successive.

- Struttura repo, `Dockerfile`, `docker-compose.yml`, `config.example.yaml`, `.env.example` (§2, §11)
- FastAPI come API JSON pura sotto `/api/*` fin dall'inizio (nessun refactor Jinja2→SPA da fare, a differenza di ratio-guardian)
- SQLAlchemy + SQLite, primo schema DB (dischi/media_path/tracker/torrent_client/app_settings — le entità di matching arrivano in Fase 4, quelle di upload in Fase 6)
- Split configurazione YAML statico / DB dinamico (§4 di ratio-guardian, ereditato)
- Container singolo con supervisord (web + worker), anche se il worker non fa ancora nulla di significativo
- CI minima (lint + test di base) — utile da subito visto l'obiettivo open source

**Definition of done**: container che si avvia, espone `/api/health`, legge `config.yaml`, applica lo schema DB iniziale. Nessuna feature utente ancora.

---

## Fase 1 — Pietra del Legame (Blu)

**Obiettivo**: modello dischi/hardlink e stato unificato per file, sezioni §3-4.

- Entità Disk (root_path, torrents_rel_path, st_dev cachato) e MediaPath (content_type, relative_path) — già mappate in `app/models.py` dalla Fase 0
- File Browser API scoped-per-disco (§5 di ratio-guardian) — riusata da ogni pagina di configurazione successiva
- Scansione filesystem: cammina MediaPath e cartella torrent di ogni disco, calcola hardlink via `(st_dev, st_ino)`
- Popolamento di `media_file` e `seed_file` (§4) a ogni scan — bulk upsert a fine giro, mai query per file (vedi §4 per il perché)
- Calcolo dello stato unificato per file (§3), **limitato per ora ai soli stati derivabili da hardlink/filesystem**: `seeding` (nlink>1, collegato — `seed_file.media_file_id` valorizzato), `orphan_media`/`orphan_torrent` come stato grezzo "nessun hardlink trovato" (senza ancora sapere *a cosa* dovrebbe collegarsi — quello arriva in Fase 4; `ignored` arriva in Fase 2, richiede sapere se un client traccia il file)
- Import massivo (scan completo una tantum) come prima modalità di esecuzione, senza ancora scheduling (Fase 5)

**Definition of done**: dato un disco configurato con path media e torrent reali, l'app produce correttamente la lista di file con/senza hardlink, verificato contro un caso reale con librerie note.

---

## Fase 2 — Pietra del Controllo (Viola)

**Obiettivo**: adapter multi-client torrent, sezione §5.

- Contratto `TorrentClientAdapter` (`add_torrent`/`get_torrent_status`, ereditati da ratio-guardian, più `list_torrents()` nuovo — enumera ogni torrent noto al client coi suoi file, non solo i path piatti ipotizzati in SPEC.md §5 originaria: serve a popolare `client_torrent`/`client_torrent_file`, non solo a sapere "è tracciato sì/no")
- Adapter qBittorrent (`qbittorrent-api`) — implementato, **non validato contro un'istanza reale** (solo contro un client mockato nei test, stesso limite di ratio-guardian)
- "qui" (punto aperto §15): risolto **pragmaticamente**, non verificato — trattato come N istanze qBittorrent indipendenti, ciascuna un proprio `TorrentClient` con `adapter_type="qbittorrent"`. Nessun adapter dedicato finché non si scopre, contro un'istanza reale, che espone invece una propria API di aggregazione
- Un disco può avere più client abilitati contemporaneamente (tabella ponte `disk_torrent_client`, già in `app/models.py` dalla Fase 0) — `app/torrent_indexer.py` aggrega su tutti i dischi di un client in un solo giro
- Calcolo completo di `orphan_torrent`/`ignored`/`seeding` in `app/library.py`, usando `client_torrent_file` (§3)
- **Deferito**: adapter Deluge, Transmission, rutorrent — non implementati in questo passaggio (costo non banale: tre protocolli diversi, JSON-RPC/RPC/XML-RPC). `adapter_factory.build_torrent_client_adapter` solleva un errore esplicito e navigabile per questi `adapter_type`, mai un fallimento silenzioso — prossimo slice della stessa Fase quando servirà davvero un client reale oltre qBittorrent.

**Definition of done**: raggiunta per qBittorrent (mockato) — `orphan_torrent`/`ignored`/`seeding` corretti su tutte le combinazioni hardlink/tracciamento (vedi `tests/test_library_states.py`). **Non ancora verificato contro un'istanza qBittorrent reale né contro un secondo client reale** (Deluge/Transmission/rutorrent deferiti, vedi sopra) — resta aperto prima di poter chiudere davvero questa fase.

---

## Fase 3 — Pietra della Conoscenza (Gialla)

**Obiettivo**: identificazione contenuto e poster, sezione §6 (resolver).

- Contratto `MediaResolverAdapter`
- Implementazione default: guessit (parsing filename) + lookup TMDB
- Download e cache locale poster (`tmdb_poster_path` → `data/posters/{tmdb_id}.jpg`)
- Adapter opzionale Sonarr/Radarr (mai assunto presente)
- Popolamento `media_item` con `tmdb_id`/season/episode per ogni file scansionato; stato `unmatched` (§3) per chi non risolve

**Definition of done**: la libreria reale dell'utente viene identificata correttamente per la stragrande maggioranza dei file (percentuale concreta da misurare, non solo "sembra funzionare"); poster visibili per i contenuti noti a TMDB.

---

## Fase 4 — Pietra della Reintegrazione (Rossa)

**Obiettivo**: motore di matching e reseeding nelle due direzioni, sezioni §6-8. La fase più corposa — eredita quasi interamente il lavoro già fatto in ratio-guardian, adattato alle due direzioni.

- Contratto `TrackerAdapter`, implementazione UNIT3D (`search_by_tmdb`, dettaglio torrent — dettagli API già verificati in ratio-guardian, da riusare senza ri-scoprirli)
- Motore di matching: size match + mediainfo Unique ID match + **hash dei piece (BEP3)** come nuovo segnale (§6) — confidence esplicita e spiegabile
- Coda di revisione (match sotto soglia → `pending`, approvazione/rifiuto manuale in UI)
- Esecutore per la direzione **media→torrent** (hardlink con nome esatto atteso dal tracker + add al client + recheck forzato, mai skip)
- Esecutore per la direzione **torrent→client** (nuova: il file esiste già, si scarica il `.torrent` e si aggiunge al client puntando al file — soglia di confidence da fissare, punto aperto §15)
- Vista Libreria — **vista ad albero** (§7), che a questo punto ha tutti i dati necessari (stato unificato + match + poster)
- Vista Libreria — **vista a griglia poster** (§7), stessa base dati, `?view=tree|grid`
- Reverse lookup dal lato torrent (ispirato ad Auditorr)

**Definition of done**: run completo su import massivo della libreria reale, con risultati corretti verificati a campione per entrambe le direzioni; nessun caso di recheck saltato; vista Libreria (albero e griglia) usabile con dati reali.

---

## Fase 5 — Pietra del Tempo (Verde)

**Obiettivo**: scheduling e osservabilità nel tempo, sezioni §8, §10.

- APScheduler in-process, cron configurabile da UI
- Run schedulato periodico (stesso motore della Fase 4, volume atteso minore)
- `run_log` con contatori (scansionati, match trovati, auto-seedati, in review, errori)
- Reconcile periodico dello stato recheck (async sul client)
- Dashboard: gauge "salute libreria", KPI (in revisione, falliti, non risolti, `orphan_torrent`, `ignored`), feed "novità dall'ultimo run"
- Snapshot periodico della percentuale "salute libreria" per il grafico storico (punto aperto §15/§17 — decidere schema qui)

**Definition of done**: uno scheduled run reale gira senza intervento manuale per più cicli consecutivi; dashboard riflette lo stato corrente e uno storico di almeno qualche run.

---

## Fase 6 — Pietra della Genesi (Arancione)

**Obiettivo**: modulo Upload, sezione §9.

- `torf` per la creazione del `.torrent`, `pymediainfo` esteso, `ffmpeg-python` per gli screenshot (v1 li include fin da subito)
- Profili tracker bundlati (seed data in repo, copiati in DB alla creazione del tracker, editabili dopo)
- Pipeline: selezione file → resolve → crea `.torrent` → mediainfo+screenshot → descrizione da template → dupe-check (`search_by_tmdb` al contrario) → **conferma umana obbligatoria** → upload → add al client
- `ImageHostAdapter` (prima implementazione da scegliere, punto aperto §15/§17)
- Entità `upload_job`, `tracker_upload_profile`

**Definition of done**: upload reale completato con successo su almeno un tracker configurato, verificato che compaia correttamente pubblicato.

---

## Fase 7 — Rilascio open source

**Obiettivo**: il repo è pubblicabile e usabile da un utente terzo senza contesto pregresso, sezione §13.

- README completo (setup, requisiti, esempio di configurazione, screenshot)
- `config.example.yaml` / `.env.example` verificati privi di qualunque dato personale
- LICENSE (già presente nel repo: GPL-3.0)
- Verifica finale che nessun default assuma il setup specifico dell'utente originale (path, tracker, nomi disco)
- Eventuali issue template / CONTRIBUTING se si vuole abilitare contributi esterni fin da subito (non bloccante per un primo rilascio)

**Definition of done**: un utente terzo, seguendo solo il README, riesce a configurare da zero un disco/tracker/client e a completare un primo scan.

---

## Fuori dalle fasi (tracciati ma non pianificati)

Tutti i punti in `docs/SPEC.md` sezione 15 non hanno una fase assegnata perché richiedono una decisione prima di poter essere pianificati (es. libreria client Deluge/Transmission/rutorrent, superficie API di "qui", host immagini per upload). Vanno sciolti *dentro* la fase a cui appartengono (rispettivamente Fase 2 e Fase 6) appena si arriva a implementarli, non prima.
