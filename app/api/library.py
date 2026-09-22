"""Lettura dello stato unificato per file (docs/SPEC.md sezione 3) e la
vista Libreria (sezione 7) — media_item raggruppati coi loro media_file,
base dati condivisa per la futura vista ad albero e a griglia poster
(il frontend che le renderizza non è ancora costruito, il progetto resta
API-only fino a quel punto)."""

import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import duplicates, library, settings_repo
from app.api_errors import coded_detail
from app.deps import get_session
from app.exclusions import CompiledExclusions, compile_exclusions

router = APIRouter(prefix="/api", tags=["library"])


def _load_exclusions(session: Session) -> CompiledExclusions:
    custom = settings_repo.get_setting(session, "exclusion_patterns")
    presets = settings_repo.get_setting(session, "exclusion_presets")
    return compile_exclusions(custom, presets)


class MediaFileState(BaseModel):
    id: int
    disk_id: int
    relative_path: str
    size_bytes: int
    state: str
    excluded: bool
    linked_paths: list[str]


class SeedFileState(BaseModel):
    id: int
    disk_id: int
    relative_path: str
    size_bytes: int
    media_file_id: int | None
    state: str
    excluded: bool
    linked_paths: list[str]


class MediaItemFile(BaseModel):
    media_file_id: int
    disk_id: int
    relative_path: str
    state: str
    excluded: bool
    linked_paths: list[str]


class DuplicateFile(BaseModel):
    media_file_id: int
    disk_id: int
    relative_path: str


class DuplicateGroup(BaseModel):
    content_hash: str
    size_bytes: int
    files: list[DuplicateFile]


class MediaItemOverview(BaseModel):
    id: int
    content_type: str
    tmdb_id: int
    season_number: int | None
    episode_number: int | None
    has_poster: bool
    files: list[MediaItemFile]


@router.get("/media-files", response_model=list[MediaFileState])
def list_media_files(disk_id: int | None = None, session: Session = Depends(get_session)):
    return library.media_file_states(session, disk_id=disk_id, exclusions=_load_exclusions(session))


@router.get("/seed-files", response_model=list[SeedFileState])
def list_seed_files(disk_id: int | None = None, session: Session = Depends(get_session)):
    return library.seed_file_states(session, disk_id=disk_id, exclusions=_load_exclusions(session))


@router.get("/library/items", response_model=list[MediaItemOverview])
def list_library_items(disk_id: int | None = None, session: Session = Depends(get_session)):
    return library.media_items_overview(session, disk_id=disk_id, exclusions=_load_exclusions(session))


@router.get("/library/unmatched", response_model=list[MediaFileState])
def list_unmatched(disk_id: int | None = None, session: Session = Depends(get_session)):
    return library.unmatched_media_files(session, disk_id=disk_id, exclusions=_load_exclusions(session))


@router.get("/library/duplicates", response_model=list[DuplicateGroup])
def list_duplicates(disk_id: int | None = None, session: Session = Depends(get_session)):
    """Copie non intenzionali dello stesso contenuto su inode diversi —
    file già hardlinkati fra loro non compaiono qui (app/duplicates.py)."""
    return duplicates.find_duplicate_media_files(session, disk_id=disk_id)


@router.get("/library/posters/{tmdb_id}.jpg")
def get_poster(tmdb_id: int, request: Request):
    posters_dir = os.path.join(request.app.state.settings.data_dir, "posters")
    local_path = os.path.join(posters_dir, f"{tmdb_id}.jpg")
    if not os.path.isfile(local_path):
        raise HTTPException(status_code=404, detail=coded_detail("poster_not_cached"))
    return FileResponse(local_path, media_type="image/jpeg")
