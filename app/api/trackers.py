"""API di configurazione per i tracker (docs/SPEC.md sezione 6)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.deps import get_session
from app.models import Tracker

router = APIRouter(prefix="/api/trackers", tags=["trackers"])

SUPPORTED_ADAPTER_TYPES = {"unit3d"}


class TrackerCreateRequest(BaseModel):
    label: str
    adapter_type: str
    base_url: str
    api_token: str
    rate_limit_per_min: int | None = None


class TrackerUpdateRequest(BaseModel):
    label: str | None = None
    base_url: str | None = None
    api_token: str | None = None
    rate_limit_per_min: int | None = None
    enabled: bool | None = None


class TrackerResponse(BaseModel):
    id: int
    label: str
    adapter_type: str
    base_url: str
    rate_limit_per_min: int | None
    enabled: bool

    @classmethod
    def from_model(cls, t: Tracker) -> "TrackerResponse":
        return cls(
            id=t.id, label=t.label, adapter_type=t.adapter_type, base_url=t.base_url,
            rate_limit_per_min=t.rate_limit_per_min, enabled=t.enabled,
        )


def _get_tracker_or_404(session: Session, tracker_id: int) -> Tracker:
    tracker = session.get(Tracker, tracker_id)
    if tracker is None:
        raise HTTPException(status_code=404, detail=f"Tracker {tracker_id} non trovato")
    return tracker


@router.get("", response_model=list[TrackerResponse])
def list_trackers(session: Session = Depends(get_session)):
    return [TrackerResponse.from_model(t) for t in session.query(Tracker).all()]


@router.post("", response_model=TrackerResponse, status_code=201)
def create_tracker(body: TrackerCreateRequest, session: Session = Depends(get_session)):
    if body.adapter_type not in SUPPORTED_ADAPTER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"adapter_type non supportato: {body.adapter_type!r} "
            f"(supportati: {sorted(SUPPORTED_ADAPTER_TYPES)})",
        )
    tracker = Tracker(
        label=body.label, adapter_type=body.adapter_type, base_url=body.base_url,
        api_token=body.api_token, rate_limit_per_min=body.rate_limit_per_min or 30,
    )
    session.add(tracker)
    session.commit()
    return TrackerResponse.from_model(tracker)


@router.patch("/{tracker_id}", response_model=TrackerResponse)
def update_tracker(tracker_id: int, body: TrackerUpdateRequest, session: Session = Depends(get_session)):
    tracker = _get_tracker_or_404(session, tracker_id)
    if body.label is not None:
        tracker.label = body.label
    if body.base_url is not None:
        tracker.base_url = body.base_url
    if body.api_token is not None:
        tracker.api_token = body.api_token
    if body.rate_limit_per_min is not None:
        tracker.rate_limit_per_min = body.rate_limit_per_min
    if body.enabled is not None:
        tracker.enabled = body.enabled
    session.commit()
    return TrackerResponse.from_model(tracker)


@router.delete("/{tracker_id}", status_code=204)
def delete_tracker(tracker_id: int, session: Session = Depends(get_session)):
    tracker = _get_tracker_or_404(session, tracker_id)
    session.delete(tracker)
    session.commit()
