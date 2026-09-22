"""Dashboard (docs/SPEC.md §10, Fase 5): gauge "salute libreria", KPI
(pending review/falliti/non risolti/orphan_torrent/ignored), storico dello
snapshot di salute per il grafico, feed "novità" — inteso qui come gli
ultimi candidate trovati (candidate.created_at, l'unico timestamp di
scoperta già presente nel modello dati), non un log di attività dedicato
che introdurrebbe una tabella nuova senza un bisogno concreto già emerso.
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import health
from app.deps import get_session
from app.models import Candidate, RunLog

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class LastRunSummary(BaseModel):
    id: int
    run_type: str
    started_at: datetime
    finished_at: datetime | None
    items_scanned: int
    matches_found: int
    auto_executed: int
    pending_review: int
    errors: int


class DashboardResponse(BaseModel):
    health_pct: float
    total_media_size: int
    seeding_media_size: int
    orphan_torrent_count: int
    ignored_count: int
    pending_review: int
    failed: int
    unmatched: int
    last_run: LastRunSummary | None


class HistoryPoint(BaseModel):
    run_id: int
    run_type: str
    finished_at: datetime | None
    health_snapshot: float
    items_scanned: int
    matches_found: int
    auto_executed: int
    pending_review: int
    errors: int


class WhatsNewItem(BaseModel):
    candidate_id: int
    media_item_id: int
    tracker_id: int
    name: str
    direction: str
    confidence: float
    created_at: datetime | None


def _last_run_summary(session: Session) -> LastRunSummary | None:
    run = session.query(RunLog).filter(RunLog.finished_at.isnot(None)).order_by(RunLog.id.desc()).first()
    if run is None:
        return None
    return LastRunSummary(
        id=run.id, run_type=run.run_type, started_at=run.started_at, finished_at=run.finished_at,
        items_scanned=run.items_scanned, matches_found=run.matches_found, auto_executed=run.auto_executed,
        pending_review=run.pending_review, errors=run.errors,
    )


@router.get("", response_model=DashboardResponse)
def get_dashboard(disk_id: int | None = None, session: Session = Depends(get_session)):
    snapshot = health.compute_snapshot(session, disk_id=disk_id)
    return DashboardResponse(**snapshot, last_run=_last_run_summary(session))


@router.get("/history", response_model=list[HistoryPoint])
def get_history(limit: int = 30, session: Session = Depends(get_session)):
    runs = (
        session.query(RunLog)
        .filter(RunLog.health_snapshot.isnot(None))
        .order_by(RunLog.id.desc())
        .limit(limit)
        .all()
    )
    return [
        HistoryPoint(
            run_id=r.id, run_type=r.run_type, finished_at=r.finished_at, health_snapshot=r.health_snapshot,
            items_scanned=r.items_scanned, matches_found=r.matches_found, auto_executed=r.auto_executed,
            pending_review=r.pending_review, errors=r.errors,
        )
        for r in runs
    ]


@router.get("/whats-new", response_model=list[WhatsNewItem])
def get_whats_new(limit: int = 20, session: Session = Depends(get_session)):
    candidates = session.query(Candidate).order_by(Candidate.id.desc()).limit(limit).all()
    return [
        WhatsNewItem(
            candidate_id=c.id, media_item_id=c.media_item_id, tracker_id=c.tracker_id, name=c.name,
            direction=c.direction, confidence=c.confidence, created_at=c.created_at,
        )
        for c in candidates
    ]
