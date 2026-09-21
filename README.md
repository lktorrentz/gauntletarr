# The Media Gauntlet*rr

Web app per gestire in un unico posto la libreria media, le cartelle di seeding torrent, la corrispondenza (hardlink) tra le due, lo stato reale sui client torrent configurati (multi-client, cross-seed incluso) e la pubblicazione di nuovi upload sui tracker.

Progetto in fase iniziale — non ancora pronto per un utente terzo (arriverà con la Fase 7, vedi sotto). Il container è comunque installabile su Unraid per verificare le fasi implementate contro un'istanza reale (per ora: scan filesystem/hardlink + adapter qBittorrent, nessuna interfaccia grafica).

- **Specifica funzionale/architetturale**: [`docs/SPEC.md`](docs/SPEC.md)
- **Piano a fasi**: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- **Schema DB**: [`docs/schema.sql`](docs/schema.sql)
- **Guida per sessioni Claude Code**: [`CLAUDE.md`](CLAUDE.md)
- **Template Unraid**: [`unraid/gauntletarr.xml`](unraid/gauntletarr.xml) — immagine pubblicata su `ghcr.io/lktorrentz/gauntletarr` a ogni push su `main` ([workflow](.github/workflows/docker-publish.yml))

Licenza: GPL-3.0 (vedi [`LICENSE`](LICENSE)).
