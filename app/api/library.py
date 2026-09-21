"""Lettura dello stato unificato per file (docs/SPEC.md sezione 3).

Endpoint minimi per la Fase 1 (verifica: "l'app produce correttamente la
lista di file con/senza hardlink" — docs/ROADMAP.md). La vera vista
Libreria (albero + griglia poster) arriva in Fase 4, quando esistono
media_item/candidate/match_review da cui derivare gli stati completi.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import library
from app.deps import get_session

router = APIRouter(prefix="/api", tags=["library"])


class MediaFileState(BaseModel):
    id: int
    disk_id: int
    relative_path: str
    size_bytes: int
    state: str


class SeedFileState(BaseModel):
    id: int
    disk_id: int
    relative_path: str
    size_bytes: int
    media_file_id: int | None
    state: str


@router.get("/media-files", response_model=list[MediaFileState])
def list_media_files(disk_id: int | None = None, session: Session = Depends(get_session)):
    return library.media_file_states(session, disk_id=disk_id)


@router.get("/seed-files", response_model=list[SeedFileState])
def list_seed_files(disk_id: int | None = None, session: Session = Depends(get_session)):
    return library.seed_file_states(session, disk_id=disk_id)
