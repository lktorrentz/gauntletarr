"""API della coda di revisione (docs/SPEC.md sezione 8) — approvazione/
rifiuto manuale dei match sotto soglia, retry delle esecuzioni fallite.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import review
from app.deps import get_session
from app.executor import ExecutionError
from app.models import Candidate, MatchReview, SeedJob

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewResponse(BaseModel):
    id: int
    candidate_id: int
    media_file_id: int | None
    seed_file_id: int | None
    status: str
    direction: str
    confidence: float
    candidate_name: str
    ambiguity_reason: str | None

    @classmethod
    def from_model(cls, r: MatchReview) -> "ReviewResponse":
        return cls(
            id=r.id, candidate_id=r.candidate_id, media_file_id=r.media_file_id, seed_file_id=r.seed_file_id,
            status=r.status, direction=r.candidate.direction, confidence=r.candidate.confidence,
            candidate_name=r.candidate.name, ambiguity_reason=r.candidate.ambiguity_reason,
        )


class SeedJobResponse(BaseModel):
    id: int
    candidate_id: int
    final_status: str
    recheck_status: str | None
    error_message: str | None

    @classmethod
    def from_model(cls, sj: SeedJob) -> "SeedJobResponse":
        return cls(
            id=sj.id, candidate_id=sj.candidate_id, final_status=sj.final_status,
            recheck_status=sj.recheck_status, error_message=sj.error_message,
        )


def _get_review_or_404(session: Session, review_id: int) -> MatchReview:
    row = session.get(MatchReview, review_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Review {review_id} non trovata")
    return row


@router.get("", response_model=list[ReviewResponse])
def list_reviews(session: Session = Depends(get_session)):
    return [ReviewResponse.from_model(r) for r in review.list_ready_for_review(session)]


@router.post("/{review_id}/approve", response_model=ReviewResponse)
def approve_review(review_id: int, session: Session = Depends(get_session)):
    row = _get_review_or_404(session, review_id)
    review.approve(session, row)
    return ReviewResponse.from_model(row)


@router.post("/{review_id}/reject", response_model=ReviewResponse)
def reject_review(review_id: int, session: Session = Depends(get_session)):
    row = _get_review_or_404(session, review_id)
    review.reject(session, row)
    return ReviewResponse.from_model(row)


@router.get("/failed", response_model=list[SeedJobResponse])
def list_failed(session: Session = Depends(get_session)):
    return [SeedJobResponse.from_model(sj) for sj in review.list_failed_seed_jobs(session)]


@router.post("/failed/{seed_job_id}/retry", response_model=SeedJobResponse)
def retry_failed(seed_job_id: int, session: Session = Depends(get_session)):
    seed_job = session.get(SeedJob, seed_job_id)
    if seed_job is None:
        raise HTTPException(status_code=404, detail=f"SeedJob {seed_job_id} non trovato")
    try:
        result = review.retry_failed(session, seed_job)
    except ExecutionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return SeedJobResponse.from_model(result)


@router.get("/candidates/{media_item_id}")
def list_candidates_for_media_item(media_item_id: int, session: Session = Depends(get_session)):
    """Sola lettura, per audit: ogni candidate valutato per un media_item,
    non solo quello scelto per la review (docs/SPEC.md sezione 6)."""
    rows = session.query(Candidate).filter_by(media_item_id=media_item_id).order_by(Candidate.confidence.desc()).all()
    return [
        {
            "id": c.id, "tracker_id": c.tracker_id, "name": c.name, "direction": c.direction,
            "confidence": c.confidence, "size_match": c.size_match, "mediainfo_match": c.mediainfo_match,
            "piece_verified": c.piece_verified, "ambiguity_reason": c.ambiguity_reason,
        }
        for c in rows
    ]
