# The Media Gauntlet*rr

A web app to manage your media library, torrent seeding folders, the hardlink correspondence between them, the real state of your configured torrent clients (multi-client, cross-seed included), and publishing new uploads to trackers - all in one place.

Early-stage project - not yet ready for third-party use (that lands with Phase 7, see the roadmap in `docs/SPEC.md` §14). A Docker image is published to `ghcr.io/lktorrentz/gauntletarr` on every push to `main` ([workflow](.github/workflows/docker-publish.yml)) for anyone who wants to run the implemented phases against a real instance (so far: filesystem/hardlink scan + qBittorrent adapter, no web UI yet).

- **Functional/architectural spec**: [`docs/SPEC.md`](docs/SPEC.md)
- **DB schema**: [`docs/schema.sql`](docs/schema.sql)

License: GPL-3.0 (see [`LICENSE`](LICENSE)).
