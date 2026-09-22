"""API di configurazione per le istanze Radarr — multi-istanza da subito
(stesso pattern di tracker/torrent_client), anche se nessun adapter le
consuma ancora (docs/SPEC.md SS2/SS6: content-identification opzionale,
mai richiesta dal resolver)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api_errors import coded_detail
from app.deps import get_session
from app.models import RadarrInstance

router = APIRouter(prefix="/api/radarr-instances", tags=["radarr-instances"])


class RadarrInstanceCreateRequest(BaseModel):
    label: str
    base_url: str
    api_key: str


class RadarrInstanceUpdateRequest(BaseModel):
    label: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    enabled: bool | None = None


class RadarrInstanceResponse(BaseModel):
    id: int
    label: str
    base_url: str
    enabled: bool  # mai api_key: write-only, non torna mai indietro

    @classmethod
    def from_model(cls, ri: RadarrInstance) -> "RadarrInstanceResponse":
        return cls(id=ri.id, label=ri.label, base_url=ri.base_url, enabled=ri.enabled)


def _get_or_404(session: Session, instance_id: int) -> RadarrInstance:
    instance = session.get(RadarrInstance, instance_id)
    if instance is None:
        raise HTTPException(status_code=404, detail=coded_detail("radarr_instance_not_found", id=instance_id))
    return instance


@router.get("", response_model=list[RadarrInstanceResponse])
def list_radarr_instances(session: Session = Depends(get_session)):
    return [RadarrInstanceResponse.from_model(ri) for ri in session.query(RadarrInstance).all()]


@router.post("", response_model=RadarrInstanceResponse, status_code=201)
def create_radarr_instance(body: RadarrInstanceCreateRequest, session: Session = Depends(get_session)):
    instance = RadarrInstance(label=body.label, base_url=body.base_url, api_key=body.api_key)
    session.add(instance)
    session.commit()
    return RadarrInstanceResponse.from_model(instance)


@router.patch("/{instance_id}", response_model=RadarrInstanceResponse)
def update_radarr_instance(
    instance_id: int, body: RadarrInstanceUpdateRequest, session: Session = Depends(get_session)
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
    return RadarrInstanceResponse.from_model(instance)


@router.delete("/{instance_id}", status_code=204)
def delete_radarr_instance(instance_id: int, session: Session = Depends(get_session)):
    instance = _get_or_404(session, instance_id)
    session.delete(instance)
    session.commit()
