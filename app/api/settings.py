"""API generica per app_settings (docs/SPEC.md — key/value libero, es.
tmdb_api_key). Non specifica per il resolver: qualunque chiave futura
(soglie di confidence, cron dello scheduler) passa da qui."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import settings_repo
from app.deps import get_session

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingUpdateRequest(BaseModel):
    value: str


class SettingResponse(BaseModel):
    key: str
    value: str | None


@router.get("/{key}", response_model=SettingResponse)
def get_setting(key: str, session: Session = Depends(get_session)):
    return SettingResponse(key=key, value=settings_repo.get_setting(session, key))


@router.put("/{key}", response_model=SettingResponse)
def set_setting(key: str, body: SettingUpdateRequest, session: Session = Depends(get_session)):
    settings_repo.set_setting(session, key, body.value)
    return SettingResponse(key=key, value=body.value)
