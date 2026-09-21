# The Media Gauntlet*rr — Spec funzionale e architetturale (v1)

Documento consolidato a partire da un flusso di idee dell'utente, riorganizzato e messo a terra confrontandolo con quattro progetti locali imparentati. Non è un brainstorming aperto: dove qualcosa è esplicitamente non deciso è segnalato come tale in fondo (sezione 15).

**Nome**: nome del progetto **"The Media Gauntlet*rr"**, repo/nome tecnico **`gauntletarr`** (stile *arr — gauntlet+arr, come Bazarr/Cleanuparr/Prowlarr — pur senza dipendere da Sonarr/Radarr, stesso "wink" stilistico già fatto da Auditorr). Richiamo volutamente giocoso all'Infinity Gauntlet: uno strumento solo che dà controllo completo su tutto l'ecosistema media/torrent/tracker, con un tocco (una "run" schedulata o un'azione manuale) che rimette a posto ciò che è rotto — da qui anche il tema delle **Media Stones** sotto, non un riferimento letterale ai nomi/loghi Marvel (evita quindi qualunque collisione di marchio: sono nomi e concetti originali, solo ispirati al genere).

## Tema: le Media Stones

Sei "pietre", una per ciascun dominio funzionale principale — usate come chiave di lettura per organizzare la spec e come base per l'identità visiva (icona/colore per modulo in dashboard e sidebar), non come rinomina dei concetti tecnici sottostanti (nel codice/API restano i nomi descrittivi normali: `media_item`, `TorrentClientAdapter`, ecc. — le Stones sono un livello di branding sopra, non una sostituzione).

| Stone | Colore | Dominio | Sezione |
|---|---|---|---|
| **Pietra del Legame** | Blu | Modello dischi/hardlink, stato unificato per file (orfani/ignorati) | §3-4 |
| **Pietra del Controllo** | Viola | Adapter multi-client torrent, stato di presenza/seeding | §5 |
| **Pietra della Conoscenza** | Gialla | Identificazione contenuto (TMDB), poster cache | §6 |
| **Pietra della Reintegrazione** | Rossa | Motore di matching e reseeding (ripara i collegamenti rotti) | §6, 8 |
| **Pietra del Tempo** | Verde | Scheduling, storico run, andamento nel tempo della dashboard | §8, 10 |
| **Pietra della Genesi** | Arancione | Upload — dà "vita nuova" a un contenuto pubblicandolo su un tracker | §9 |

"Indossare il guanto" = avere tutte e sei le Stones configurate e attive (dischi mappati, client connessi, resolver funzionante, motore di matching attivo, scheduler configurato, upload pronto) — utile anche come metafora per un eventuale onboarding/setup wizard in UI: una checklist a sei voci, una per Stone, prima che il sistema sia "completo".

## 0. Provenienza — da dove nasce questo progetto

Questo non riparte da zero. Sintetizza:

- **`ratio-guardian`** (`/Users/lucazonarelli/Projects/ratio-guardian/docs/SPEC.md`): l'analisi architetturale più matura e più vicina a questo scope — modello dischi/hardlink senza dipendenza da Unraid/FUSE, matching engine TMDB con confidence esplicita, motore di reseeding con recheck forzato, e — deciso nella sessione più recente di quel progetto — una seconda modalità "Upload" ispirata a Upload-Assistant. Gauntletarr **eredita l'intera architettura dati e il motore di matching/reseeding di ratio-guardian**, che va letta per i dettagli implementativi verificati (shape reale delle API UNIT3D, bug noti già risolti come il confronto size sui season pack, edge case mediainfo). Questo documento non ripete quei dettagli quando non cambiano, li richiama.
- **Auditorr**: riferimento per l'esperienza di visualizzazione — vista ad albero della libreria, stato per-file (presenza/hardlink/seeding), dashboard con gauge "salute libreria", reverse hardlink lookup dal lato torrent.
- **Upload-Assistant**: riferimento di dominio per il flusso di upload (mediainfo, screenshot, descrizione, dupe-check, ~90 tracker supportati). **In development freeze** dichiarato dal progetto stesso — va trattato come riferimento di dominio da reimplementare contro i propri contratti, mai come dipendenza viva.
- **smartmediareseed**: riferimento per la verifica di identità file↔torrent tramite **hash dei piece** (BEP3) contro l'hash dichiarato nel `.torrent` — segnale di confidence più forte del solo mediainfo Unique ID (che non distingue tracce audio diverse a parità di video). Va integrato come segnale aggiuntivo nel matching engine (sezione 6), non come sostituto del recheck reale.

## 1. Visione e problema

L'utente gestisce una libreria media (film/serie) e una o più cartelle di seeding torrent, spesso su dischi fisici separati senza RAID/FUSE. Con l'uso quotidiano si accumula disallineamento:

- file spostati/rinominati nella libreria che rompono l'hardlink e quindi il seeding, senza che l'utente se ne accorga (il problema centrale di ratio-guardian);
- file presenti nella cartella torrent ma che il client torrent non sta più tracciando (rimossi dal client, client reinstallato, migrazione mai completata);
- file in seeding che non sono mai stati organizzati/collegati nella libreria media vera e propria;
- file scaricati/organizzati che non sono mai stati identificati correttamente (nessun match TMDB), quindi invisibili a qualunque logica di matching.

Gauntletarr deve dare **una singola vista coerente dello stato di ogni file**, sui due lati (media e torrent) e sul client torrent stesso, più gli strumenti per risolvere ogni tipo di disallineamento: reseeding, collegamento manuale, upload di contenuto nuovo.

## 2. Requisiti di genericità (vincolanti, ereditati da ratio-guardian §2)

- **Non deve assumere Unraid/FUSE.** N dischi fisici separati, ciascuno con propria porzione di libreria, senza filesystem unificante.
- **Non deve assumere Sonarr/Radarr.** Integrazione opzionale come adapter aggiuntivo del media resolver, mai come dipendenza.
- **Architettura ad adapter per tracker, client torrent e resolver media**, per permettere estensione futura senza riscritture (dettaglio in sezione 5).
- Distribuzione: container Docker, Web UI per la configurazione.
- **Progettato per rilascio pubblico/open source** (decisione esplicita, diversa dai tool sorgente che sono a uso personale): implica config di esempio senza dati personali, nessun segreto hardcoded, `.env.example`/`config.example.yaml` puliti, LICENSE, e attenzione a non assumere il setup specifico dell'utente (path, tracker, nomi disco) in nessun default.

## 3. Le due direzioni del problema: orfani e ignorati

Punto centrale della richiesta originale, distinto (e complementare) al modello "media→torrent" già coperto da ratio-guardian. Vanno mantenute **entrambe le direzioni di scansione**, sullo stesso grafo di hardlink:

### Direzione media → torrent (già coperta dal motore di ratio-guardian)

File nella media library **senza** hardlink valido verso la cartella torrent del disco → candidati al motore di matching/reseeding (sezione 6). Questo è il caso "ho spostato/rinominato il file e ho rotto il seeding".

### Direzione torrent → client/media (nuovo requisito di Gauntletarr)

Per ogni file nella cartella torrent di un disco:

- **File orfano**: presente sul filesystem (cartella torrent) ma **non tracciato da nessun client torrent configurato** (nessun torrent nel client il cui path risolto punta a quel file). Tipicamente: file rimasto dopo rimozione dal client, migrazione client mai completata, client riconfigurato. Azione naturale: stesso motore di reseeding di ratio-guardian ma innescato dal lato torrent — cerca sui tracker configurati un match per quel file (size + mediainfo + hash piece, sezione 6), e se il match è a confidence massima (100%, non la soglia 0.95 usata per il caso media→torrent — vedi nota sotto) **scarica il `.torrent` dal tracker e lo aggiunge al client puntando al file già presente**, senza dover ricreare l'hardlink (il file è già lì).
- **File ignorato**: presente sul filesystem (cartella torrent) e tracciato correttamente dal client, ma **senza alcun hardlink corrispondente in nessuna `MediaPath` abilitata**. È un file in seeding "orfano dalla libreria": tecnicamente sano, ma invisibile all'organizzazione media dell'utente. Azione: solo segnalazione in UI (mai automatica) — l'utente valuta se vale la pena organizzarlo (hardlink manuale verso una MediaPath) o lasciarlo così (es. cross-seed di contenuto non suo).

**Nota sulla soglia per gli orfani lato torrent**: qui il rischio è diverso da quello discusso in ratio-guardian §9 (falso positivo che porta a seedare dati sbagliati). Aggiungere un torrent già presente localmente su un tracker in base a un match sbagliato è comunque rischioso (associa il file a un torrent che non è, il client lo recheck-a e nella peggiore ipotesi fallisce — meno grave di un falso hardlink ma non innocuo). Trattare quindi con la **stessa severità**: soglia alta configurabile, sotto soglia va in coda di revisione manuale come nel caso media→torrent, mai un bypass "perché il file esiste già".

### Stato unificato per file

Ogni file (sui due lati) deve esporre uno stato composito, ispirato alla pagina Libreria di ratio-guardian (§12) ma esteso:

| Stato | Significato |
|---|---|
| `seeding` | Hardlink valido + tracciato dal client, seeding attivo |
| `orphan_media` | In libreria media, nessun hardlink valido (candidato reseeding — direzione media→torrent) |
| `orphan_torrent` | In cartella torrent, non tracciato da alcun client (candidato reseeding — direzione torrent→client) |
| `ignored` | In cartella torrent, tracciato dal client, nessun hardlink verso la libreria media |
| `unmatched` | Nessun match TMDB risolto (filename non parsabile, o nessun candidato tracker), a prescindere dal lato |
| `pending_review` | Match trovato ma sotto soglia di confidence, in coda di revisione manuale |

## 4. Architettura dati (eredita ratio-guardian §3-4, §13 — estesa qui)

Modello dischi/librerie invariato rispetto a ratio-guardian: entità **Disk** (root fisico, `st_dev` cachato per rilevare rimonti), **MediaPath** (una o più per disco, tipizzate `movie`/`tv`), path sempre relativi al disco (mai assoluti), validazione a doppio livello (file browser scoped in UI + confronto `st_dev` a runtime prima di ogni hardlink). Vedi ratio-guardian SPEC.md §3 per il ragionamento completo — non va rifatto qui. Schema DB completo, tabella per tabella: `docs/schema.sql`.

### Perché non basta il modello di ratio-guardian così com'è

Ratio-guardian fonde identità logica e file fisico in un'unica riga (`media_item` ha sia `tmdb_id` che `file_path`/`inode`) e **non ha alcuna tabella per l'inventario dei client torrent** — verifica "è già in seeding" con un check live sul filesystem (`find -samefile`) più query al client solo al momento dell'esecuzione. Funziona per un solo client e senza bisogno di vedere il cross-seed, ma non regge i requisiti di Gauntletarr (multi-client, vista a griglia raggruppata per contenuto, visibilità esplicita di ogni claimant cross-seed — §3, §5, §7). Analizzato anche il modello di Auditorr come riferimento negativo: tiene tutto in blob JSON ricalcolati ad ogni run e, per il cross-seed, fonde tutti i claimant sullo stesso inode tenendo solo "il più sano" (`audit.py::_walk_directory`, righe 106-124) — scelta efficiente ma **con perdita di informazione**, esattamente il contrario di quello che serve qui.

### Le entità (fisico separato da logico, come da discussione)

```
media_item            -- identità logica risolta: tmdb_id, season, episode, poster
  media_file           -- fisico, lato media: disk_id, relative_path, size, st_dev/inode
                        --   "as of last scan", media_item_id (FK)

seed_file              -- fisico, lato torrent: disk_id, relative_path, size, st_dev/inode
                        --   "as of last scan", media_file_id (FK, nullable — vedi sotto)
                        --   un file per ogni hardlink sibling: 3 cross-seed = 3 righe

torrent_client          -- config (esiste già)
  client_torrent          -- UN torrent per UNA istanza client: info_hash, name, save_path,
                          --   category, state, tracker_url — UNIQUE(torrent_client_id, info_hash)
    client_torrent_file     -- UN file dentro un client_torrent: path_in_torrent, size,
                            --   seed_file_id (FK, nullable)
```

`media_item` separato da `media_file` (a differenza di ratio-guardian, dove sono la stessa riga) perché la vista a griglia (§7) deve raggruppare più file fisici sotto un solo poster — caso comune per una stagione con più episodi, o un contenuto con più versioni/qualità in libreria.

### Le due FK e perché sono scritte in modo diverso

- **`seed_file.media_file_id`** (collegamento via inode, cross-seed): **mai calcolata a runtime con un join live** su `(disk_id, st_dev, inode)` — su una libreria grande sarebbe ricalcolata ad ogni caricamento della tree/grid view. Va invece:
  1. calcolata **una volta per scan**, in memoria, durante lo stesso `os.walk` già necessario per leggere `st_dev`/`inode`/`nlink` (stessa tecnica di Auditorr — un dict tenuto per la durata dello scan — ma qui **senza scartare i claimant "perdenti"**: ogni sibling resta una riga);
  2. scritta con un **bulk upsert a fine scan** (batch insert/update, mai una query per file);
  3. marcata con `last_scan_id` (FK a `run_log`) — un `seed_file` non ri-visto in uno scan successivo non va cancellato subito (la coda di revisione deve poterlo ancora mostrare come "sparito"), ma la sua `media_file_id` smette di essere attendibile per i calcoli di stato correnti finché non viene ri-confermato. Questo evita il rischio concreto di inode riassegnati dal filesystem tra uno scan e l'altro (stesso problema già segnalato come aperto in ratio-guardian §17 — qui reso esplicito e gestito).
- **`client_torrent_file.seed_file_id`** (collegamento via path, non via inode): risolta confrontando `client_torrent.save_path + path_in_torrent` contro `disk.root_path + seed_file.relative_path` — non soffre di riassegnazione (un path non viene "riusato" per un file diverso nello stesso modo di un inode), quindi più stabile tra uno scan e l'altro, ma comunque riverificata ad ogni scan per coerenza.

In lettura, ogni query di stato (§3) e ogni conteggio dashboard (§10) è un JOIN indicizzato su queste FK — mai un calcolo su `st_dev`/`inode` a runtime, che restano colonne di **sola scrittura** per il processo di scan.

### Altre estensioni

- **Poster cache**: `media_item.tmdb_poster_path` (path relativo TMDB) + cache locale delle immagini scaricate (filesystem, non blob in DB — path prevedibile tipo `data/posters/{tmdb_id}.jpg`, scaricato una sola volta e riusato). Necessaria per la vista a griglia (§7).
- Configurazione split YAML statico (`disk_scan_root`, `data_dir`) / DB dinamico (dischi, media path, tracker, client, soglie) — invariato da ratio-guardian §4.

Entità di matching/reseeding (`candidate`, `match_review`, `seed_job`) e le nuove entità upload (§9) restano come da ratio-guardian, adattate per riferirsi a `media_item`/`media_file` invece che alla riga fusa di ratio-guardian — dettaglio completo in `docs/schema.sql`.

## 5. Client torrent: supporto multi-client fin dalla v1

Requisito esplicito, diverso da ratio-guardian (che parte da un solo adapter qBittorrent ed è genericamente estendibile ma senza impegno immediato su altri client). Priorità:

1. **qBittorrent** — via `qbittorrent-api`, primo adapter, implementato (`app/adapters/torrent_client/qbittorrent.py`). **Non validato contro un'istanza reale**, solo contro un client mockato nei test (stesso limite dichiarato da ratio-guardian per lo stesso adapter).
2. **qui** (gestore multi-istanza per qBittorrent) — risolto **pragmaticamente** in Fase 2, non verificato contro un'istanza reale: trattato come N istanze qBittorrent indipendenti, ciascuna un proprio `TorrentClient` con `adapter_type="qbittorrent"` puntato al `base_url` che `qui` espone per quell'istanza. Nessun adapter dedicato, finché non si scopre il contrario contro un'installazione reale.
3. **Deluge**, 4. **Transmission**, 5. **rutorrent** — **deferiti**, non implementati in Fase 2 (tre protocolli diversi — JSON-RPC/RPC/XML-RPC — costo non banale per un solo passaggio). `app/adapter_factory.py` solleva un errore esplicito per questi `adapter_type`, mai un fallimento silenzioso.

Tutti dietro lo stesso contratto `TorrentClientAdapter` — `add_torrent`/`get_torrent_status` ereditati da ratio-guardian §14 invariati, **`list_torrents()` sostituisce l'ipotesi iniziale `list_tracked_paths()`** (implementato in `app/adapters/torrent_client/base.py`, diverso da questo primo abbozzo):

```python
class TorrentClientAdapter(ABC):
    def add_torrent(self, torrent_file_or_url, save_path, force_recheck=True) -> str: ...
    def get_torrent_status(self, info_hash) -> TorrentStatus: ...
    def list_torrents(self) -> list[ClientTorrentInfo]:
        """Ogni torrent noto al client, coi suoi file (path_in_torrent + size).
        Serve a popolare client_torrent/client_torrent_file (sezione 4), non solo
        a sapere se un path è tracciato sì/no — da cui poi si derivano
        orphan_torrent/ignored/seeding, mai calcolati dall'adapter stesso."""
```

Un disco/torrents_rel_path può essere associato a più client configurati contemporaneamente (caso comune: qBittorrent per un gruppo di tracker, rutorrent per un altro, sullo stesso disco) — l'indicizzazione (`app/torrent_indexer.py`) aggrega quindi su tutti i client abilitati per quel disco, non assume mai 1:1.

## 6. Identificazione contenuto (TMDB) e motore di matching

### Resolver media (eredita ratio-guardian §6)

Default: parsing filename (guessit) → lookup TMDB. Adapter opzionale Sonarr/Radarr per mapping più affidabile, mai assunto presente.

**Estensione per la vista a griglia**: al momento della risoluzione TMDB, scaricare e cachare il poster (`tmdb_poster_path` → immagine locale, sezione 4). Un `media_item` senza poster disponibile (contenuto molto di nicchia, o TMDB non lo ha) mostra un placeholder in UI, mai un errore bloccante.

### Motore di matching (eredita ratio-guardian §7-8, integrato con smartmediareseed)

Pipeline invariata nella struttura (storico personale se disponibile → ricerca per tmdb_id sul catalogo → size match → mediainfo Unique ID match → confidence esplicita e spiegabile, mai ML opaco). Vedi ratio-guardian SPEC.md §7-8 per tutti i dettagli verificati (shape API UNIT3D, gestione season pack, limiti dello storico personale via scraping).

**Nuovo segnale di confidence**, raccomandazione già scritta nell'analisi di smartmediareseed e qui recepita come requisito: **verifica hash dei piece** (parsing bencode BEP3 del `.torrent` scaricato, confronto byte-esatto contro il contenuto locale) come segnale aggiuntivo, più forte del solo mediainfo Unique ID perché deterministico e non soggetto al limite noto (stesso video, audio diverso → stesso Unique ID a volte). Da usare per:
- alzare la confidence quando size+mediainfo sono già concordanti ma non a certezza assoluta;
- **unico segnale accettabile per l'auto-esecuzione della direzione torrent→client** (sezione 3) dove serve una soglia più alta che nel caso media→torrent, perché lì il file esiste già e un match sbagliato aggiunge un torrent non corrispondente in modo meno recuperabile con il solo recheck.

Il **recheck forzato sul client rimane comunque sempre obbligatorio** in ogni caso di aggiunta al client (mai `skip_checking`) — l'hash dei piece è un segnale di matching più forte, non un sostituto della verifica del client stesso.

## 7. Vista Libreria: albero + griglia poster

Due modalità di visualizzazione della stessa base dati (stato unificato per file, sezione 3), selezionabili dall'utente, ispirate rispettivamente ad Auditorr (albero) e alla richiesta esplicita di griglia poster:

- **Vista ad albero**: struttura cartelle reale della libreria media (per disco → per MediaPath → sottocartelle), ogni nodo file mostra badge di stato (pill colorata, stessi stati della sezione 3) e, se disponibile, mini-poster inline. Click su un file mostra il dettaglio: path media, path torrent (se hardlinkato), tracker + link diretto, stato client + deep-link, link TMDB — stesso set di colonne della pagina Libreria di ratio-guardian §12, qui presentato come pannello di dettaglio invece che come tabella.
- **Vista a griglia**: card per ogni `media_item` con poster TMDB (fallback placeholder), titolo, anno, badge di stato. Pensata per la ricognizione visiva rapida ("cosa ho, cosa manca, cosa è rotto") più che per il dettaglio tecnico — quello resta a un click di distanza (stesso pannello di dettaglio dell'albero).
- **Filtri condivisi tra le due viste**: per stato (tutti gli stati della sezione 3), per disco, per MediaPath/content_type, ricerca testuale per titolo.
- **Reverse lookup dal lato torrent** (ispirato ad Auditorr): dato un torrent nel client, mostrare a quale/i file di libreria corrisponde (via hardlink) — utile per capire "perché questo è in seeding" senza dover cercare manualmente.

Le due viste condividono backend/API — è solo `?view=tree|grid` sulla stessa risorsa filtrata, mai due pipeline dati separate.

## 8. Motore di reseeding ed esecuzione

Eredita interamente ratio-guardian §9-11:
- Soglia di confidence configurabile (default 0.95) sopra la quale l'esecuzione è automatica, sotto la quale va in coda di revisione manuale — **stessa logica per entrambe le direzioni** (media→torrent e torrent→client, sezione 3), con soglie eventualmente diverse per le due (vedi nota in sezione 6).
- Hardlink con nome esatto atteso dal tracker (solo direzione media→torrent — nella direzione torrent→client il file è già al posto giusto, si aggiunge solo il torrent al client).
- Recheck forzato, mai skip.
- Reconcile periodico dello stato recheck (async sul client).
- Modalità import massivo (scan completo una tantum) + run schedulato (cron configurabile da UI), entrambe sullo stesso motore.

## 9. Upload: creazione e pubblicazione di un nuovo torrent

Eredita interamente ratio-guardian §16, incluso il ragionamento su cosa riusare da Upload-Assistant (libreria `torf` per creare il `.torrent`, `pymediainfo` esteso, `ffmpeg-python` per gli screenshot, dupe-check via lo stesso `TrackerAdapter.search_by_tmdb`) e cosa non riusare (nessun codice diretto da Upload-Assistant, che è in development freeze — solo riferimento di dominio per la shape delle richieste UNIT3D e i profili tracker).

Punti che restano invariati:
- Dominio dati separato (`upload_job`, `tracker_upload_profile`), non tocca mai le entità di reseeding.
- Profili tracker bundlati come seed data versionato nel repo, copiati in DB alla creazione del tracker, editabili liberamente dopo senza mai essere riletti dal file.
- Conferma umana obbligatoria prima dell'invio, non negoziabile quanto il recheck forzato del reseeding.
- v1 include già mediainfo + screenshot (non rimandati).

## 10. UI/UX — struttura generale

```
Libreria
  Vista ad albero        (§7)
  Vista a griglia         (§7)
  Orfani e ignorati       [n]  (§3 — entrambe le direzioni, con azioni contestuali)

Reseeding
  Dashboard
  Revisione          [n]  (match_review pending, entrambe le direzioni)
  Verifica da .torrent
  Run

Upload
  Nuovo upload
  Coda upload        [n]
  Template descrizione

Configurazione
  Dischi
  Client torrent          (multi-client, §5)
  Tracker
  Impostazioni
```

Dashboard: eredita ratio-guardian §15 (gauge salute libreria, KPI in revisione/falliti/non risolti, feed novità) — **KPI aggiuntivi** per riflettere le due direzioni: count `orphan_torrent` e count `ignored` con link diretto ai rispettivi filtri in Libreria.

Stack frontend: **SPA React + shadcn/ui** (decisione già presa in ratio-guardian il 2026-09-21, qui ereditata fin dall'inizio invece che come refactor successivo — Gauntletarr parte già con backend FastAPI come API JSON pura sotto `/api/*`, nessuna fase Jinja2/HTMX da superare).

## 11. Stack tecnico

Eredita ratio-guardian (CLAUDE.md), con le aggiunte per multi-client e poster:

- **Python 3.12**, **FastAPI** (API JSON pura sotto `/api/*`)
- **SQLite** via SQLAlchemy — sufficiente per questo carico
- **APScheduler** in-process per lo scheduling
- **httpx** per le chiamate a tracker/TMDB (async-friendly)
- **qbittorrent-api**, più libreria/i client per Deluge/Transmission/rutorrent (da scegliere in fase di implementazione, sezione 5)
- **pymediainfo** per mediainfo/Unique ID
- **guessit** per il parsing filename
- **torf** per la creazione dei `.torrent` in upload (puro Python)
- **ffmpeg-python** per gli screenshot in upload (richiede `ffmpeg` nel container)
- Parser bencode BEP3 minimale (già presente in ratio-guardian come `app/torrent_file.py`, riusabile) — usato sia per il fallback nome cartella (ratio-guardian §7) sia per l'hash dei piece (sezione 6)
- **Frontend**: SPA **React + shadcn/ui**, build Vite, servita dal container FastAPI
- **Container singolo con supervisord** (web + worker/scheduler), stesso pattern di ratio-guardian

## 12. Cosa riusare da ciascun progetto sorgente (riepilogo)

| Progetto | Riuso |
|---|---|
| ratio-guardian | Architettura dati, motore matching/reseeding, contratti adapter — **base di partenza diretta**, non solo ispirazione. Codice Python riusabile quasi as-is dove lo scope coincide (torrent_file.py, mediainfo_util.py, adapters). |
| Auditorr | Riferimento UX (vista ad albero, dashboard, reverse lookup) — nessun riuso di codice diretto (stack/linguaggio da verificare in fase di implementazione se compatibile, altrimenti solo riferimento di design). |
| Upload-Assistant | Riferimento di dominio per upload (shape richieste tracker, profili, mediainfo/screenshot) — **nessun riuso di codice** (development freeze, stack incompatibile: web_ui Flask/SSE vs FastAPI+SPA). |
| smartmediareseed | Tecnica di verifica hash piece (BEP3) da integrare come segnale di confidence aggiuntivo (sezione 6) — logica da reimplementare contro i propri contratti, non da importare (stack Postgres/Flask diverso). |

## 13. Requisiti open source

- Nessun dato personale (path, tracker, credenziali dell'utente) in nessun file versionato — `config.example.yaml`/`.env.example` con placeholder generici.
- LICENSE esplicita (da scegliere — MIT/AGPL sono le scelte tipiche per questo tipo di self-hosted tool, AGPL se si vuole scoraggiare fork SaaS chiusi).
- Profili tracker bundlati (sezione 9) contengono solo mapping/naming pubblicamente verificabili, mai credenziali.
- Documentazione di setup (README) sufficiente per un utente terzo che non ha il contesto delle sessioni di design — non assumere che il lettore conosca ratio-guardian o gli altri progetti sorgente.

## 14. Roadmap suggerita

1. Bootstrap progetto (stack, struttura cartelle, requirements) — riusando struttura/config di ratio-guardian come riferimento.
2. Schema DB (dischi/media path/torrent index/tracker/client/media_item con poster/candidate/match_review/seed_job) + modelli SQLAlchemy.
3. File browser API scoped-per-disco (pattern riusabile as-is da ratio-guardian).
4. Adapter torrent client: qBittorrent prima (riuso diretto), poi Deluge/Transmission/rutorrent/qui secondo priorità sezione 5.
5. Resolver media (guessit + TMDB) + download/cache poster.
6. Motore di matching (size + mediainfo + hash piece) nelle due direzioni (sezione 3), confidence esplicita.
7. Coda di revisione UI.
8. Esecutore: hardlink + add-to-client + recheck forzato, entrambe le direzioni.
9. Vista Libreria (albero + griglia) sulla base dello stato unificato.
10. Scheduler + storico run.
11. Modulo Upload (torf, mediainfo/screenshot, profili tracker, dupe-check, conferma umana).
12. Pulizia per rilascio open source (config esempio, LICENSE, README).

Non vincolante alla lettera, ma rispetta le dipendenze logiche (es. non ha senso costruire la vista Libreria prima che esista uno stato unificato da mostrare). Piano dettagliato a fasi (dipendenze, deliverable, definition of done per fase): `docs/ROADMAP.md`.

**Repo**: `https://github.com/lktorrentz/gauntletarr` (pubblico, GPL-3.0). Progetto **separato da `ratio-guardian`** (decisione confermata: non lo sostituisce, non ne riusa il codice as-is — riusa architettura/pattern come descritto in questo documento, ma è un repo e una history proprie).

## 15. Cose esplicitamente aperte (non decise in questa sessione)

- **Superficie API di "qui"**: risolto per ora con l'assunzione pragmatica "basta l'adapter qBittorrent puntato a ogni istanza gestita" (sezione 5) — **non verificato** contro un'istanza reale di qui né di qBittorrent. Da confermare appena disponibile un'istanza reale.
- **Adapter Deluge/Transmission/rutorrent**: deferiti in Fase 2 (sezione 5), non implementati — quale libreria Python usare per ciascuno resta da decidere quando si riprende quello slice.
- **Soglia di confidence per la direzione torrent→client** (sezione 3, 6): se identica a 0.95 o più alta — da decidere, non ancora un numero fissato.
- Tutti i punti già aperti in ratio-guardian SPEC.md §17 (scraping storico UNIT3D, cache persistente del match indipendente dal path fisico, host immagini per gli screenshot di upload, schema esatto profilo tracker, storico per il grafico dashboard) restano aperti anche qui, invariati.
