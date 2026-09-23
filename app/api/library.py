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

from app import duplicates, library
from app.api_errors import coded_detail
from app.deps import get_session
from app.exclusions import CompiledExclusions, load_exclusions
from app.poster_cache import poster_file

router = APIRouter(prefix="/api", tags=["library"])


def _load_exclusions(session: Session) -> CompiledExclusions:
    return load_exclusions(session)


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
    duplicate: bool = False  # altra copia dello stesso contenuto su un inode diverso
    in_review: bool = False  # match trovato, in attesa di approvazione in Reseeding


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
    title: str | None = None
    year: int | None = None
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


@router.get("/library/posters/{content_type}/{tmdb_id}.jpg")
def get_poster(content_type: str, tmdb_id: int, request: Request):
    posters_dir = os.path.join(request.app.state.settings.data_dir, "posters")
    local_path = poster_file(posters_dir, content_type, tmdb_id)
    if not os.path.isfile(local_path):
        raise HTTPException(status_code=404, detail=coded_detail("poster_not_cached"))
    # Il frontend li scarica con fetch + header di autenticazione (un <img>
    # non manda l'header): la cache del browser evita di riscaricarli.
    return FileResponse(local_path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})
