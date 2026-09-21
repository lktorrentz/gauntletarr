# The Media Gauntlet*rr

A web app to manage your media library, torrent seeding folders, the hardlink correspondence between them, the real state of your configured torrent clients (multi-client, cross-seed included), and publishing new uploads to trackers - all in one place.

Early-stage project - not yet ready for third-party use (that lands with Fase 7, see below). The container can still be installed on Unraid to verify the implemented phases against a real instance (so far: filesystem/hardlink scan + qBittorrent adapter, no web UI yet).

- **Functional/architectural spec**: [`docs/SPEC.md`](docs/SPEC.md)
- **Phased roadmap**: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- **DB schema**: [`docs/schema.sql`](docs/schema.sql)
- **Guide for Claude Code sessions**: [`CLAUDE.md`](CLAUDE.md)
- **Unraid template**: [`unraid/gauntletarr.xml`](unraid/gauntletarr.xml) - image published to `ghcr.io/lktorrentz/gauntletarr` on every push to `main` ([workflow](.github/workflows/docker-publish.yml))

License: GPL-3.0 (see [`LICENSE`](LICENSE)).
