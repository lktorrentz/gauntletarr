# The Media Gauntlet*rr (repo: gauntletarr) — guida per la sessione Claude Code

## Cos'è

Web app (FastAPI + worker in background, distribuita come container Docker) per gestire in un unico posto: la libreria media, le cartelle di seeding torrent, la corrispondenza (hardlink) tra le due, lo stato reale sui client torrent configurati, e la pubblicazione di nuovi upload sui tracker.

Nasce dalla fusione di quattro progetti locali imparentati — **leggi `docs/SPEC.md` sezione 0 prima di scrivere codice**, spiega cosa viene ereditato da ciascuno:

- `ratio-guardian` (`/Users/lucazonarelli/Projects/ratio-guardian`) — architettura dati e motore di matching/reseeding, base di partenza diretta, non solo ispirazione.
- Auditorr — riferimento UX (vista ad albero, dashboard, reverse lookup).
- Upload-Assistant — riferimento di dominio per il flusso di upload (in development freeze, nessun riuso di codice).
- smartmediareseed — tecnica di verifica hash dei piece, integrata come segnale di confidence aggiuntivo.

**Non è specifico per Unraid né per arr-stack.** Deve girare con dischi separati senza FUSE/RAID e senza Sonarr/Radarr — adapter opzionali, mai dipendenze. Il nome è un wink stilistico allo stack *arr (gauntlet+arr, come Bazarr/Prowlarr), non una dipendenza funzionale. **Progettato per rilascio open source**: nessun dato personale in file versionati, config di esempio generici.

**Tema "Media Stones"**: sei domini funzionali, ciascuno associato a una "pietra" (icona/colore in UI) — vedi `docs/SPEC.md` per la tabella completa. Riferimento giocoso all'Infinity Gauntlet, ma nomi e concetti originali (Legame, Controllo, Conoscenza, Reintegrazione, Tempo, Genesi) — nessun riferimento letterale a marchi Marvel, va mantenuto così anche nell'implementazione (naming di codice/UI originale, mai i nomi Marvel veri).

Il documento completo è `docs/SPEC.md` — contiene tutte le decisioni prese (modello dischi/hardlink, le due direzioni "orfani"/"ignorati", multi-client torrent, matching TMDB + hash piece, vista libreria albero/griglia, motore di reseeding, upload). Non redecidere quelle cose da zero — se qualcosa sembra sbagliato o incompleto, fermati e chiedi prima di deviare.

## Stack tecnico

- **Python 3.12**, FastAPI come API JSON pura sotto `/api/*` fin dall'inizio (nessuna fase Jinja2/HTMX da superare, a differenza di ratio-guardian che l'ha introdotta come refactor successivo)
- **SQLite** via SQLAlchemy
- **APScheduler** in-process per lo scheduling
- **httpx** per tracker/TMDB
- **qbittorrent-api** come primo adapter client torrent; Deluge/Transmission/rutorrent/qui a seguire (vedi `docs/SPEC.md` §5, priorità e librerie da scegliere ancora aperte)
- **pymediainfo**, **guessit**, **torf** (creazione `.torrent` per upload), **ffmpeg-python** (screenshot upload)
- Parser bencode BEP3 minimale — riusabile da `ratio-guardian/app/torrent_file.py`
- **Frontend**: SPA React + shadcn/ui, build Vite, servita dal container
- **Container singolo con supervisord** (web + worker/scheduler)

## Convenzioni ereditate da ratio-guardian (non rinegoziabili)

- **Adapter come contratti**, mai implementazioni fisse — tracker, media resolver, torrent client.
- **Ogni azione distruttiva o irreversibile passa dalla coda di revisione se la confidence non è massima** — vale per entrambe le direzioni di matching (media→torrent e torrent→client, `docs/SPEC.md` §3), non solo per il caso storico di ratio-guardian.
- **Mai `skip_checking` sul client torrent.** Recheck reale sempre, in ogni aggiunta al client.
- **Path traversal**: ogni endpoint che tocca il filesystem passa dalla funzione di scoping condivisa (stesso pattern di ratio-guardian, `app/fs_scope.py` è riusabile as-is).
- **Configurazione**: solo `disk_scan_root`/`data_dir` in YAML statico (richiede restart); tutto il resto (dischi, media path, tracker, client, soglie) nel DB, editabile da UI senza restart.

## Cose esplicitamente NON decise (chiedi all'utente, non assumere)

Vedi `docs/SPEC.md` sezione 15 per l'elenco completo.

**Confermato**: progetto separato da `ratio-guardian`, repo proprio (`https://github.com/lktorrentz/gauntletarr`, GPL-3.0), non lo sostituisce e non ne riusa il codice as-is — solo architettura/pattern.

## Roadmap a fasi

Piano completo con deliverable e definition of done per fase: **`docs/ROADMAP.md`**. Una fase = una o più Media Stone completate (vedi tema in `docs/SPEC.md`). Non saltare fasi né invertirne l'ordine senza motivo esplicito — le dipendenze sono reali (es. il motore di matching in Fase 4 richiede gli adapter client della Fase 2 e il resolver della Fase 3 già funzionanti).
