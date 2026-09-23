"""Library health snapshot (docs/SPEC.md §10, Fase 5).

Metrica scelta deliberatamente più semplice del punteggio pesato multi-
fattore di Auditorr (`process_health_metrics`: pesi 70/10/10/10 configurabili
su hardlink/orphan/not-imported/duplicati, ciascuno con una propria soglia
di tolleranza) — qui `orphan_torrent`/`ignored`/pending review/falliti sono
già KPI distinti e cliccabili in dashboard (SPEC.md §10), quindi il gauge
di "salute" copre un solo segnale chiaro e spiegabile: la percentuale
(pesata per dimensione, non per conteggio file) di libreria media
effettivamente seeding. Un multi-fattore pesato si può aggiungere in futuro
se un singolo numero risulta insufficiente — non introdotto ora senza un
bisogno concreto già osservato.
"""

from sqlalchemy.orm import Session

from app import library, review
from app.exclusions import load_exclusions


def compute_snapshot(session: Session, disk_id: int | None = None) -> dict:
    # Stessi file che si vedono nelle viste: gli esclusi non contano mai.
    exclusions = load_exclusions(session)
    media_states = [f for f in library.media_file_states(session, disk_id=disk_id, exclusions=exclusions)
                    if not f["excluded"]]
    seed_states = [f for f in library.seed_file_states(session, disk_id=disk_id, exclusions=exclusions)
                   if not f["excluded"]]

    total_media_size = sum(f["size_bytes"] for f in media_states)
    seeding_media_size = sum(f["size_bytes"] for f in media_states if f["state"] == "seeding")
    # Libreria vuota: nessun file non sano, trattata come 100% sana
    # piuttosto che 0/0 indefinito.
    health_pct = round((seeding_media_size / total_media_size) * 100, 1) if total_media_size else 100.0

    return {
        "health_pct": health_pct,
        "total_media_size": total_media_size,
        "seeding_media_size": seeding_media_size,
        "orphan_torrent_count": sum(1 for f in seed_states if f["state"] == "orphan_torrent"),
        "ignored_count": sum(1 for f in seed_states if f["state"] == "ignored"),
        "pending_review": len(review.list_ready_for_review(session)),
        "failed": len(review.list_failed_seed_jobs(session)),
        "unmatched": sum(
            1 for f in library.unmatched_media_files(session, disk_id=disk_id, exclusions=exclusions)
            if not f["excluded"]
        ),
    }
