"""API generica per app_settings (docs/SPEC.md — key/value libero, es.
tmdb_api_key). Non specifica per il resolver: qualunque chiave futura
(soglie di confidence, cron dello scheduler) passa da qui."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import settings_repo
from app.deps import get_session
from app.exclusions import DEFAULT_ENABLED_PRESETS, PRESETS

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingUpdateRequest(BaseModel):
    value: str


class SettingResponse(BaseModel):
    key: str
    value: str | None


class ExclusionPresetResponse(BaseModel):
    key: str
    patterns: list[str]
    enabled_by_default: bool  # attivo finché exclusion_presets non viene mai salvato


@router.get("/exclusion-presets/available", response_model=list[ExclusionPresetResponse])
def list_exclusion_presets():
    """Preset pronti per esclusioni note (sidecar dei client torrent più
    comuni + spazzatura tipica di release scena) — l'utente li abilita in
    Impostazioni senza doverne conoscere i pattern esatti."""
    return [
        ExclusionPresetResponse(key=key, patterns=patterns, enabled_by_default=key in DEFAULT_ENABLED_PRESETS)
        for key, patterns in PRESETS.items()
    ]


@router.get("/{key}", response_model=SettingResponse)
def get_setting(key: str, session: Session = Depends(get_session)):
    return SettingResponse(key=key, value=settings_repo.get_setting(session, key))


@router.put("/{key}", response_model=SettingResponse)
def set_setting(key: str, body: SettingUpdateRequest, session: Session = Depends(get_session)):
    settings_repo.set_setting(session, key, body.value)
    return SettingResponse(key=key, value=body.value)
