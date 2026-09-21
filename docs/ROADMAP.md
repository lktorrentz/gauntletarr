# Phased roadmap - The Media Gauntlet*rr

Each phase roughly corresponds to completing one Media Stone (see `docs/SPEC.md`, section "Theme: the Media Stones"), plus a Phase 0 for foundations and a Phase 7 to close out for the open source release. Phases are sequential by logical dependency (there's no point building the matching engine before the client adapters and media resolver it consumes exist), but **they are not meant as fixed-length sprints** - each one closes when its definition of done is met, not on a deadline.

Section references always point to `docs/SPEC.md`.

---

## Phase 0 - Foundations (no Stone)

**Goal**: the project skeleton every later phase builds on.

- Repo structure, `Dockerfile`, `docker-compose.yml`, `config.example.yaml`, `.env.example` (§2, §11)
- FastAPI as a pure JSON API under `/api/*` from the start (no Jinja2->SPA refactor to do, unlike ratio-guardian)
- SQLAlchemy + SQLite, first DB schema (disks/media_path/tracker/torrent_client/app_settings - matching entities arrive in Phase 4, upload ones in Phase 6)
- Static YAML / dynamic DB config split (ratio-guardian §4, inherited)
- Single container with supervisord (web + worker), even though the worker doesn't do anything meaningful yet
- Minimal CI (lint + basic tests) - useful from day one given the open source goal

**Definition of done**: container starts, exposes `/api/health`, reads `config.yaml`, applies the initial DB schema. No user-facing features yet.

---

## Phase 1 - Stone of Bond (Blue)

**Goal**: disk/hardlink model and unified per-file state, sections §3-4.

- Disk entity (root_path, torrents_rel_path, cached st_dev) and MediaPath (content_type, relative_path) - already mapped in `app/models.py` since Phase 0
- Scoped-per-disk File Browser API (ratio-guardian §5) - reused by every later configuration page
- Filesystem scan: walks each disk's MediaPath and torrent folder, computes hardlinks via `(st_dev, st_ino)`
- Populates `media_file` and `seed_file` (§4) on every scan - bulk upsert at the end of the pass, never a per-file query (see §4 for why)
- Computes the unified per-file state (§3), **limited for now to states derivable from hardlinks/filesystem alone**: `seeding` (nlink>1, linked - `seed_file.media_file_id` set), `orphan_media`/`orphan_torrent` as a raw "no hardlink found" state (without yet knowing *what* it should link to - that arrives in Phase 4; `ignored` arrives in Phase 2, it needs to know whether a client is tracking the file)
- Bulk import (one-off full scan) as the first execution mode, no scheduling yet (Phase 5)

**Definition of done**: given a disk configured with real media and torrent paths, the app correctly produces the list of files with/without a hardlink, verified against a real case with known libraries.

---

## Phase 2 - Stone of Control (Purple)

**Goal**: multi-client torrent adapters, section §5.

- `TorrentClientAdapter` contract (`add_torrent`/`get_torrent_status`, inherited from ratio-guardian, plus a new `list_torrents()` - enumerates every torrent known to the client along with its files, not just the flat paths originally sketched in SPEC.md §5: needed to populate `client_torrent`/`client_torrent_file`, not just to know "is it tracked, yes/no")
- qBittorrent adapter (`qbittorrent-api`) - implemented, **not validated against a real instance** (only against a mocked client in tests, same limitation ratio-guardian states for itself)
- "qui" (open point §15): resolved **pragmatically**, unverified - treated as N independent qBittorrent instances, each its own `TorrentClient` with `adapter_type="qbittorrent"`. No dedicated adapter unless a real instance turns out to expose its own aggregation API instead
- A disk can have several clients enabled at once (`disk_torrent_client` bridge table, already in `app/models.py` since Phase 0) - `app/torrent_indexer.py` aggregates across all of a client's disks in a single pass
- Full computation of `orphan_torrent`/`ignored`/`seeding` in `app/library.py`, using `client_torrent_file` (§3)
- **Deferred**: Deluge, Transmission, rutorrent adapters - not implemented in this pass (non-trivial cost: three different protocols, JSON-RPC/RPC/XML-RPC). `adapter_factory.build_torrent_client_adapter` raises an explicit, actionable error for these `adapter_type` values, never a silent failure - next slice of this same phase once a real client beyond qBittorrent is actually needed.

**Definition of done**: reached for qBittorrent (mocked) - `orphan_torrent`/`ignored`/`seeding` correct across every hardlink/tracking combination (see `tests/test_library_states.py`). **Not yet verified against a real qBittorrent instance or a second real client** (Deluge/Transmission/rutorrent deferred, see above) - stays open before this phase can really be called closed.

---

## Phase 3 - Stone of Knowledge (Yellow)

**Goal**: content identification and posters, section §6 (resolver).

- `MediaResolverAdapter` contract
- Default implementation: guessit (filename parsing) + TMDB lookup
- Poster download and local cache (`tmdb_poster_path` -> `data/posters/{tmdb_id}.jpg`)
- Optional Sonarr/Radarr adapter (never assumed present)
- Populates `media_item` with `tmdb_id`/season/episode for every scanned file; `unmatched` state (§3) for anything that doesn't resolve

**Definition of done**: the user's real library resolves correctly for the vast majority of files (a concrete percentage to measure, not just "seems to work"); posters visible for content TMDB knows about.

---

## Phase 4 - Stone of Reintegration (Red)

**Goal**: the matching and reseeding engine for both directions, sections §6-8. The heaviest phase - inherits almost all the work already done in ratio-guardian, adapted to both directions.

- `TrackerAdapter` contract, UNIT3D implementation (`search_by_tmdb`, torrent detail - API details already verified in ratio-guardian, to be reused rather than rediscovered)
- Matching engine: size match + mediainfo Unique ID match + **piece hash (BEP3)** as a new signal (§6) - explicit, explainable confidence
- Review queue (a match below threshold -> `pending`, manual approve/reject in the UI)
- Executor for the **media->torrent** direction (hardlink with the exact name the tracker expects + add to client + forced recheck, never skipped)
- Executor for the **torrent->client** direction (new: the file already exists, download the `.torrent` and add it to the client pointing at the file - confidence threshold still to be fixed, open point §15)
- Library view - **tree view** (§7), which by this point has all the data it needs (unified state + match + poster)
- Library view - **poster grid view** (§7), same underlying data, `?view=tree|grid`
- Reverse lookup from the torrent side (inspired by Auditorr)

**Definition of done**: a full bulk-import run over the real library, results spot-checked as correct for both directions; no recheck ever skipped; library view (tree and grid) usable with real data.

---

## Phase 5 - Stone of Time (Green)

**Goal**: scheduling and observability over time, sections §8, §10.

- In-process APScheduler, cron configurable from the UI
- Periodic scheduled run (same engine as Phase 4, expected lower volume)
- `run_log` with counters (scanned, matches found, auto-executed, pending review, errors)
- Periodic reconciliation of recheck status (async on the client)
- Dashboard: "library health" gauge, KPIs (pending review, failed, unresolved, `orphan_torrent`, `ignored`), "what's new since the last run" feed
- Periodic snapshot of the "library health" percentage for the historical chart (open point §15/§17 - schema to decide here)

**Definition of done**: a real scheduled run goes through several consecutive cycles with no manual intervention; the dashboard reflects the current state and at least a handful of runs of history.

---

## Phase 6 - Stone of Genesis (Orange)

**Goal**: the Upload module, section §9.

- `torf` to create the `.torrent`, extended `pymediainfo`, `ffmpeg-python` for screenshots (v1 includes them from the start)
- Bundled tracker profiles (seed data in the repo, copied into the DB when a tracker is created, editable afterwards)
- Pipeline: select file -> resolve -> create `.torrent` -> mediainfo+screenshots -> description from template -> dupe-check (`search_by_tmdb` run in reverse) -> **mandatory human confirmation** -> upload -> add to client
- `ImageHostAdapter` (first implementation still to be chosen, open point §15/§17)
- `upload_job`, `tracker_upload_profile` entities

**Definition of done**: a real upload completes successfully on at least one configured tracker, verified to show up correctly published.

---

## Phase 7 - Open source release

**Goal**: the repo is publishable and usable by a third-party user with no prior context, section §13.

- Complete README (setup, requirements, config example, screenshots)
- `config.example.yaml` / `.env.example` verified free of any personal data
- LICENSE (already in the repo: GPL-3.0)
- Final check that no default assumes the original user's specific setup (paths, trackers, disk names)
- Issue templates / CONTRIBUTING if external contributions should be enabled from day one (not blocking for a first release)

**Definition of done**: a third-party user, following only the README, manages to configure a disk/tracker/client from scratch and complete a first scan.

---

## Outside the phases (tracked but not scheduled)

Every point in `docs/SPEC.md` section 15 has no phase assigned because it needs a decision before it can be scheduled (e.g. which client library for Deluge/Transmission/rutorrent, "qui"'s API surface, image host for uploads). They get resolved *inside* the phase they belong to (Phase 2 and Phase 6 respectively) once implementation actually reaches them, not before.
