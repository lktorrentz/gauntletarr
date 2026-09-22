"""API di configurazione per le istanze Sonarr — vedi app/api/radarr_instances.py,
stesso ruolo e stesso stato (nessun adapter concreto le consuma ancora)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api_errors import coded_detail
from app.deps import get_session
from app.models import SonarrInstance

router = APIRouter(prefix="/api/sonarr-instances", tags=["sonarr-instances"])


class SonarrInstanceCreateRequest(BaseModel):
    label: str
    base_url: str
    api_key: str


class SonarrInstanceUpdateRequest(BaseModel):
    label: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    enabled: bool | None = None


class SonarrInstanceResponse(BaseModel):
    id: int
    label: str
    base_url: str
    enabled: bool  # mai api_key: write-only, non torna mai indietro

    @classmethod
    def from_model(cls, si: SonarrInstance) -> "SonarrInstanceResponse":
        return cls(id=si.id, label=si.label, base_url=si.base_url, enabled=si.enabled)


def _get_or_404(session: Session, instance_id: int) -> SonarrInstance:
    instance = session.get(SonarrInstance, instance_id)
    if instance is None:
        raise HTTPException(status_code=404, detail=coded_detail("sonarr_instance_not_found", id=instance_id))
    return instance


@router.get("", response_model=list[SonarrInstanceResponse])
def list_sonarr_instances(session: Session = Depends(get_session)):
    return [SonarrInstanceResponse.from_model(si) for si in session.query(SonarrInstance).all()]


@router.post("", response_model=SonarrInstanceResponse, status_code=201)
def create_sonarr_instance(body: SonarrInstanceCreateRequest, session: Session = Depends(get_session)):
    instance = SonarrInstance(label=body.label, base_url=body.base_url, api_key=body.api_key)
    session.add(instance)
    session.commit()
    return SonarrInstanceResponse.from_model(instance)


@router.patch("/{instance_id}", response_model=SonarrInstanceResponse)
def update_sonarr_instance(
    instance_id: int, body: SonarrInstanceUpdateRequest, session: Session = Depends(get_session)
):
    instance = _get_or_404(session, instance_id)
    if body.label is not None:
        instance.label = body.label
    if body.base_url is not None:
        instance.base_url = body.base_url
    if body.api_key is not None:
        instance.api_key = body.api_key
    if body.enabled is not None:
        instance.enabled = body.enabled
    session.commit()
    return SonarrInstanceResponse.from_model(instance)


@router.delete("/{instance_id}", status_code=204)
def delete_sonarr_instance(instance_id: int, session: Session = Depends(get_session)):
    instance = _get_or_404(session, instance_id)
    session.delete(instance)
    session.commit()
