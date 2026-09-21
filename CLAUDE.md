# The Media Gauntlet*rr (repo: gauntletarr) - guide for the Claude Code session

## What it is

A web app (FastAPI + background worker, distributed as a Docker container) to manage in one place: the media library, torrent seeding folders, the hardlink correspondence between them, the real state of configured torrent clients, and publishing new uploads to trackers.

Born from merging four related local projects - **read `docs/SPEC.md` section 0 before writing code**, it explains what's inherited from each:

- `ratio-guardian` (`/Users/lucazonarelli/Projects/ratio-guardian`) - data architecture and matching/reseeding engine, a direct starting point, not just inspiration.
- Auditorr - UX reference (tree view, dashboard, reverse lookup).
- Upload-Assistant - domain reference for the upload flow (in development freeze, no code reuse).
- smartmediareseed - piece-hash verification technique, integrated as an additional confidence signal.

**Not specific to Unraid or the *arr stack.** Must run with separate disks with no FUSE/RAID and no Sonarr/Radarr - optional adapters, never dependencies. The name is a stylistic wink to the *arr stack (gauntlet+arr, like Bazarr/Prowlarr), not a functional dependency. **Designed for open source release**: no personal data in versioned files, generic example config.

**"Media Stones" theme**: six functional domains, each tied to a "stone" (icon/color in the UI) - see `docs/SPEC.md` for the full table. A playful nod to the Infinity Gauntlet, but with original names and concepts (Bond, Control, Knowledge, Reintegration, Time, Genesis) - no literal reference to Marvel trademarks, and that has to stay true in the implementation too (original code/UI naming, never the real Marvel names).

The full document is `docs/SPEC.md` - it contains every decision made so far (disk/hardlink model, the two "orphan"/"ignored" directions, multi-client torrent support, TMDB + piece-hash matching, tree/grid library view, reseeding engine, uploads). Don't re-decide those from scratch - if something looks wrong or incomplete, stop and ask before deviating.

## Tech stack

- **Python 3.12**, FastAPI as a pure JSON API under `/api/*` from the start (no Jinja2/HTMX phase to outgrow, unlike ratio-guardian which introduced that as a later refactor)
- **SQLite** via SQLAlchemy
- **APScheduler** in-process for scheduling
- **httpx** for tracker/TMDB calls
- **qbittorrent-api** as the first torrent client adapter; Deluge/Transmission/rutorrent/qui to follow (see `docs/SPEC.md` §5 - priority and libraries still open)
- **pymediainfo**, **guessit**, **torf** (creates `.torrent` files for uploads), **ffmpeg-python** (upload screenshots)
- Minimal BEP3 bencode parser - reusable from `ratio-guardian/app/torrent_file.py`
- **Frontend**: React + shadcn/ui SPA, Vite build, served by the container
- **Single container with supervisord** (web + worker/scheduler)

## Conventions inherited from ratio-guardian (non-negotiable)

- **Adapters are contracts**, never fixed implementations - tracker, media resolver, torrent client.
- **Every destructive or irreversible action goes through the review queue unless confidence is maximal** - applies to both matching directions (media->torrent and torrent->client, `docs/SPEC.md` §3), not just ratio-guardian's original case.
- **Never `skip_checking` on the torrent client.** Always a real recheck, on every add to the client.
- **Path traversal**: every endpoint touching the filesystem goes through the shared scoping function (same pattern as ratio-guardian, `app/fs_scope.py` is reusable as-is).
- **Configuration**: only `disk_scan_root`/`data_dir` in static YAML (requires a restart); everything else (disks, media paths, trackers, clients, thresholds) lives in the DB, editable from the UI without a restart.

## Things explicitly NOT decided (ask the user, don't assume)

See `docs/SPEC.md` section 15 for the full list.

**Confirmed**: a project separate from `ratio-guardian`, its own repo (`https://github.com/lktorrentz/gauntletarr`, GPL-3.0) - doesn't replace it and doesn't reuse its code as-is, only its architecture/patterns.

## Phased roadmap

Full plan with deliverables and a definition of done per phase: **`docs/ROADMAP.md`**. One phase = one or more Media Stones completed (see the theme in `docs/SPEC.md`). Don't skip phases or reorder them without an explicit reason - the dependencies are real (e.g. the matching engine in Phase 4 needs the Phase 2 client adapters and the Phase 3 resolver already working).
