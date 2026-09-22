"""Coda di revisione: crea e gestisce le righe match_review.

Vedi docs/SPEC.md sezione 8. Ogni file orfano (media_file o seed_file)
produce al massimo UNA riga di review, sul suo candidate a confidence più
alta — le alternative restano visibili in `candidate` per audit ma non
generano righe di review proprie. Sopra soglia -> auto_approved
(l'esecuzione vera richiede comunque conferma umana esplicita, vedi
approve()). Sotto soglia ma con un candidato plausibile -> pending.
Nessun candidato plausibile (confidence 0.0 per tutti) -> nessuna riga di
review, niente da decidere.

Soglie separate per le due direzioni (docs/SPEC.md sezione 3): per
torrent_to_client il rischio di un match sbagliato è diverso (si aggiunge
un torrent a un file che esiste già, non si crea un hardlink su dati
sbagliati), ma trattato con la stessa severità — soglia più alta di
default, mai un bypass "perché il file esiste già"."""

import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.adapter_factory import build_torrent_client_adapter
from app.executor import ExecutionError, execute_review, reconcile_seed_job, retry_seed_job
from app.models import Candidate, MatchReview, MediaFile, SeedFile, SeedJob, TorrentClient
from app.settings_repo import get_setting

logger = logging.getLogger(__name__)

DEFAULT_CONFIDENCE_THRESHOLD_MEDIA_TO_TORRENT = 0.95
DEFAULT_CONFIDENCE_THRESHOLD_TORRENT_TO_CLIENT = 0.98

READY_FOR_DECISION_STATUSES = ("pending", "auto_approved")


def get_confidence_threshold(session: Session, direction: str) -> float:
    key = f"confidence_threshold_auto_{direction}"
    default = (
        DEFAULT_CONFIDENCE_THRESHOLD_MEDIA_TO_TORRENT
        if direction == "media_to_torrent"
        else DEFAULT_CONFIDENCE_THRESHOLD_TORRENT_TO_CLIENT
    )
    raw = get_setting(session, key)
    return float(raw) if raw is not None else default


def _supersede_active_reviews(session: Session, *, media_file_id: int | None, seed_file_id: int | None) -> int:
    """Marca come 'rejected' ogni review ancora attiva per lo stesso file
    orfano. Senza questo, ogni nuovo run che rimatcha lo stesso file
    aggiungerebbe una nuova review lasciando quella vecchia in coda per
    sempre — mai più di una valutazione attiva alla volta per lo stesso file."""
    query = session.query(MatchReview).filter(MatchReview.status.in_(READY_FOR_DECISION_STATUSES))
    if media_file_id is not None:
        query = query.filter(MatchReview.media_file_id == media_file_id)
    else:
        query = query.filter(MatchReview.seed_file_id == seed_file_id)
    stale = query.all()
    for review in stale:
        review.status = "rejected"
        review.decided_by = "system"
        review.decided_at = datetime.now(UTC)
    if stale:
        session.commit()
    return len(stale)


def _create_review(
    session: Session, candidates: list[Candidate], *, media_file_id: int | None, seed_file_id: int | None
) -> MatchReview | None:
    if not candidates:
        return None

    _supersede_active_reviews(session, media_file_id=media_file_id, seed_file_id=seed_file_id)

    best = max(candidates, key=lambda c: c.confidence)
    if best.confidence <= 0.0:
        return None

    direction = best.direction
    threshold = get_confidence_threshold(session, direction)
    if best.confidence >= threshold:
        review = MatchReview(
            candidate_id=best.id, media_file_id=media_file_id, seed_file_id=seed_file_id,
            status="auto_approved", decided_by="system", decided_at=datetime.now(UTC),
        )
    else:
        review = MatchReview(
            candidate_id=best.id, media_file_id=media_file_id, seed_file_id=seed_file_id, status="pending"
        )

    session.add(review)
    session.commit()
    return review


def create_review_for_media_file(
    session: Session, media_file: MediaFile, candidates: list[Candidate]
) -> MatchReview | None:
    return _create_review(session, candidates, media_file_id=media_file.id, seed_file_id=None)


def create_review_for_seed_file(
    session: Session, seed_file: SeedFile, candidates: list[Candidate]
) -> MatchReview | None:
    return _create_review(session, candidates, media_file_id=None, seed_file_id=seed_file.id)


def _build_torrent_client_adapter_or_none(session: Session):
    """Ritorna (adapter, torrent_client_id) — l'id serve a executor.py per
    risolvere l'eventuale path override specifico di QUESTO client per il
    disco coinvolto (disk_torrent_client.torrent_client_root_path, non un
    campo del disco). (None, None) se nessun client abilitato."""
    torrent_client_row = session.query(TorrentClient).filter_by(enabled=True).first()
    if torrent_client_row is None:
        logger.info("Nessun client torrent configurato: esecuzione rimandata")
        return None, None
    return build_torrent_client_adapter(torrent_client_row), torrent_client_row.id


def _try_execute(session: Session, review: MatchReview) -> None:
    adapter, torrent_client_id = _build_torrent_client_adapter_or_none(session)
    if adapter is None:
        return
    try:
        execute_review(session, review, adapter, torrent_client_id)
    except ExecutionError:
        logger.exception(
            "Esecuzione immediata fallita per review %s (visibile tra le esecuzioni fallite, ritenta da lì)",
            review.id,
        )
    except Exception:
        logger.exception("Errore inatteso nell'esecuzione immediata per review %s", review.id)


def approve(session: Session, review: MatchReview, decided_by: str = "user") -> MatchReview:
    """Approva e prova subito l'esecuzione (hardlink+seed, o solo add al
    client) se un client torrent è configurato. Un fallimento
    dell'esecuzione non annulla l'approvazione: resta approved con il
    seed_job in stato failed — ritenta da list_failed_seed_jobs()."""
    review.status = "approved"
    review.decided_by = decided_by
    review.decided_at = datetime.now(UTC)
    session.commit()
    _try_execute(session, review)
    return review


def reject(session: Session, review: MatchReview, decided_by: str = "user") -> MatchReview:
    review.status = "rejected"
    review.decided_by = decided_by
    review.decided_at = datetime.now(UTC)
    session.commit()
    return review


def execute_auto_approved(session: Session) -> dict[str, int]:
    """Esegue automaticamente ogni review che il sistema ha già classificato
    auto_approved (confidence sopra soglia, docs/SPEC.md sezione 8) e non ha
    ancora un seed_job — mai le review 'pending', che restano sempre in
    attesa di un'approvazione umana esplicita via API. Chiamata da
    app/pipeline.py subito dopo il matching di ogni run."""
    reviews = [
        r
        for r in session.query(MatchReview).filter(MatchReview.status == "auto_approved").all()
        if not session.query(SeedJob).filter_by(candidate_id=r.candidate_id).count()
    ]
    for review in reviews:
        approve(session, review, decided_by="system")
    return {"executed": len(reviews)}


def list_ready_for_review(session: Session) -> list[MatchReview]:
    """match_review in attesa di una decisione (pending o auto_approved) il
    cui candidate non ha ancora un seed_job — esclude quelle già eseguite
    (con successo o meno) in un tentativo precedente."""
    reviews = session.query(MatchReview).filter(MatchReview.status.in_(READY_FOR_DECISION_STATUSES)).all()
    return [
        r
        for r in reviews
        if not session.query(SeedJob).filter_by(candidate_id=r.candidate_id).count()
    ]


def approve_all(session: Session, decided_by: str = "user") -> int:
    reviews = list_ready_for_review(session)
    for review in reviews:
        approve(session, review, decided_by=decided_by)
    return len(reviews)


def list_failed_seed_jobs(session: Session) -> list[SeedJob]:
    return session.query(SeedJob).filter_by(final_status="failed").all()


def retry_failed(session: Session, seed_job: SeedJob) -> SeedJob:
    adapter, torrent_client_id = _build_torrent_client_adapter_or_none(session)
    if adapter is None:
        raise ExecutionError("Nessun client torrent configurato")
    return retry_seed_job(session, seed_job, adapter, torrent_client_id)


def retry_all_failed(session: Session) -> dict[str, int]:
    seed_jobs = list_failed_seed_jobs(session)
    succeeded = 0
    failed = 0
    for seed_job in seed_jobs:
        try:
            result = retry_failed(session, seed_job)
        except ExecutionError:
            logger.exception("Retry fallito per seed_job %s", seed_job.id)
            failed += 1
            continue
        if result.final_status == "failed":
            failed += 1
        else:
            succeeded += 1
    return {"succeeded": succeeded, "failed": failed}


def reconcile_pending_seed_jobs(session: Session) -> dict[str, int]:
    """Ricontrolla lo stato reale nel client per ogni seed_job ancora
    'in_progress' con un info_hash già noto — una sola interrogazione di
    stato per client (mai un hardlink o un add_torrent), quindi non viola
    la regola "nessuna esecuzione senza conferma umana"."""
    adapter, _torrent_client_id = _build_torrent_client_adapter_or_none(session)
    if adapter is None:
        return {"reconciled": 0, "errors": 0}

    pending = (
        session.query(SeedJob)
        .filter(SeedJob.final_status == "in_progress")
        .filter(SeedJob.info_hash.isnot(None))
        .all()
    )
    reconciled = 0
    errors = 0
    for seed_job in pending:
        try:
            reconcile_seed_job(session, seed_job, adapter)
            reconciled += 1
        except Exception:
            logger.exception("Reconcile fallito per seed_job %s", seed_job.id)
            errors += 1
    return {"reconciled": reconciled, "errors": errors}
