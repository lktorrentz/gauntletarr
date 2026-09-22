"""Trigger e stato delle run (docs/SPEC.md sezione 11) — scan filesystem
+ indicizzazione client torrent, orchestrati da app/pipeline.py.

Solo import massivo per ora, innescato manualmente via API e mandato in
background (FastAPI BackgroundTasks — niente scheduler vero, quello
arriva in Fase 5 con APScheduler) così la richiesta HTTP non resta
bloccata per la durata di una run su una libreria grande.
"""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, sessionmaker

from app import pipeline
from app.api_errors import coded_detail
from app.deps import get_session
from app.models import RunLog

router = APIRouter(prefix="/api/runs", tags=["runs"])


class RunResponse(BaseModel):
    id: int
    run_type: str
    started_at: datetime
    finished_at: datetime | None
    current_phase: str | None
    items_scanned: int
    errors: int
    last_error: str | None

    @classmethod
    def from_model(cls, run: RunLog) -> "RunResponse":
        return cls(
            id=run.id, run_type=run.run_type, started_at=run.started_at,
            finished_at=run.finished_at, current_phase=run.current_phase,
            items_scanned=run.items_scanned, errors=run.errors, last_error=run.last_error,
        )


def _run_bulk_import_bg(session_factory: sessionmaker, run_id: int, data_dir: str) -> None:
    session = session_factory()
    try:
        run = session.get(RunLog, run_id)
        pipeline.run_bulk_import(session, run, data_dir)
    finally:
        session.close()


@router.post("", response_model=RunResponse, status_code=202)
def trigger_bulk_import(
    request: Request, background_tasks: BackgroundTasks, session: Session = Depends(get_session)
):
    run = pipeline.start_run(session, run_type="bulk_import")
    background_tasks.add_task(
        _run_bulk_import_bg, request.app.state.session_factory, run.id, request.app.state.settings.data_dir
    )
    return RunResponse.from_model(run)


@router.get("", response_model=list[RunResponse])
def list_runs(session: Session = Depends(get_session)):
    return [RunResponse.from_model(r) for r in session.query(RunLog).order_by(RunLog.id.desc()).all()]


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: int, session: Session = Depends(get_session)):
    run = session.get(RunLog, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=coded_detail("run_not_found", id=run_id))
    return RunResponse.from_model(run)
