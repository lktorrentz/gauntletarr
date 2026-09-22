"""API del modulo Upload (docs/SPEC.md §9, Fase 6). Selezione file tramite
lo stesso file browser scoped per-disco già usato altrove (app/fs_scope.py,
mai un path assoluto passato direttamente dal client)."""

import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import adapter_factory, upload
from app.adapter_factory import ImageHostConfigError, TmdbApiKeyMissingError
from app.adapters.tracker.base import UploadError
from app.deps import get_session
from app.fs_scope import ScopeViolation, resolve_scoped
from app.models import Disk, TorrentClient, Tracker, TrackerUploadProfile, UploadJob
from app.upload import UploadPreparationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


class UploadCreateRequest(BaseModel):
    disk_id: int
    relative_path: str
    tracker_id: int


class UploadPatchRequest(BaseModel):
    category_id: int | None = None
    type_id: int | None = None
    resolution_id: int | None = None
    tmdb_id: int | None = None
    imdb_id: str | None = None
    description_rendered: str | None = None


class UploadConfirmRequest(BaseModel):
    torrent_client_id: int


class DupeCandidateResponse(BaseModel):
    torrent_id_remote: str
    name: str
    size_bytes: int


class UploadResponse(BaseModel):
    id: int
    source_path: str
    tracker_id: int
    status: str
    tmdb_id: int | None
    imdb_id: str | None
    category_id: int | None
    type_id: int | None
    resolution_id: int | None
    info_hash: str | None
    mediainfo_text: str | None
    screenshot_urls: list[str]
    description_rendered: str | None
    torrent_id_remote: str | None
    error_message: str | None

    @classmethod
    def from_model(cls, j: UploadJob) -> "UploadResponse":
        return cls(
            id=j.id, source_path=j.source_path, tracker_id=j.tracker_id, status=j.status, tmdb_id=j.tmdb_id,
            imdb_id=j.imdb_id, category_id=j.category_id, type_id=j.type_id, resolution_id=j.resolution_id,
            info_hash=j.info_hash, mediainfo_text=j.mediainfo_text,
            screenshot_urls=json.loads(j.screenshot_urls_json) if j.screenshot_urls_json else [],
            description_rendered=j.description_rendered, torrent_id_remote=j.torrent_id_remote,
            error_message=j.error_message,
        )


def _get_upload_or_404(session: Session, upload_id: int) -> UploadJob:
    job = session.get(UploadJob, upload_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"upload_job {upload_id} non trovato")
    return job


def _get_tracker_or_404(session: Session, tracker_id: int) -> Tracker:
    tracker = session.get(Tracker, tracker_id)
    if tracker is None:
        raise HTTPException(status_code=404, detail=f"Tracker {tracker_id} non trovato")
    return tracker


@router.get("", response_model=list[UploadResponse])
def list_uploads(session: Session = Depends(get_session)):
    return [UploadResponse.from_model(j) for j in session.query(UploadJob).order_by(UploadJob.id.desc()).all()]


@router.get("/{upload_id}", response_model=UploadResponse)
def get_upload(upload_id: int, session: Session = Depends(get_session)):
    return UploadResponse.from_model(_get_upload_or_404(session, upload_id))


@router.post("", response_model=UploadResponse, status_code=201)
def create_upload(body: UploadCreateRequest, session: Session = Depends(get_session)):
    disk = session.get(Disk, body.disk_id)
    if disk is None:
        raise HTTPException(status_code=404, detail=f"Disk {body.disk_id} non trovato")
    tracker = _get_tracker_or_404(session, body.tracker_id)
    try:
        source_path = resolve_scoped(disk.root_path, body.relative_path)
    except ScopeViolation as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not os.path.isfile(source_path):
        raise HTTPException(status_code=400, detail=f"Non è un file: {body.relative_path!r}")

    try:
        resolver = adapter_factory.build_media_resolver(session)
    except TmdbApiKeyMissingError:
        resolver = None  # identificazione opzionale a questo punto, mai bloccante (docs/SPEC.md §6)

    job = upload.create_draft(session, source_path, tracker, resolver)
    return UploadResponse.from_model(job)


@router.post("/{upload_id}/prepare", response_model=UploadResponse)
def prepare_upload(upload_id: int, request: Request, session: Session = Depends(get_session)):
    job = _get_upload_or_404(session, upload_id)
    tracker = _get_tracker_or_404(session, job.tracker_id)
    profile = session.get(TrackerUploadProfile, tracker.id)
    if profile is None:
        raise HTTPException(status_code=400, detail=f"Tracker {tracker.label!r} non ha un profilo di upload")
    try:
        image_host_chain = adapter_factory.build_image_host_chain(session)
    except ImageHostConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    data_dir = request.app.state.settings.data_dir
    try:
        job = upload.prepare(session, job, tracker, profile, image_host_chain, data_dir)
    except UploadPreparationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UploadResponse.from_model(job)


@router.patch("/{upload_id}", response_model=UploadResponse)
def patch_upload(upload_id: int, body: UploadPatchRequest, session: Session = Depends(get_session)):
    job = _get_upload_or_404(session, upload_id)
    for field in ("category_id", "type_id", "resolution_id", "tmdb_id", "imdb_id", "description_rendered"):
        value = getattr(body, field)
        if value is not None:
            setattr(job, field, value)
    session.commit()
    return UploadResponse.from_model(job)


@router.get("/{upload_id}/dupe-check", response_model=list[DupeCandidateResponse])
def dupe_check(upload_id: int, session: Session = Depends(get_session)):
    job = _get_upload_or_404(session, upload_id)
    if job.tmdb_id is None:
        raise HTTPException(status_code=400, detail="upload_job senza tmdb_id: imposta prima l'identificazione")
    tracker = _get_tracker_or_404(session, job.tracker_id)
    tracker_adapter = adapter_factory.build_tracker_adapter(tracker)
    try:
        candidates = upload.dupe_check(job.tmdb_id, tracker_adapter)
    except UploadError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return [
        DupeCandidateResponse(torrent_id_remote=c.torrent_id_remote, name=c.name, size_bytes=c.size_bytes)
        for c in candidates
    ]


@router.post("/{upload_id}/confirm", response_model=UploadResponse)
def confirm_upload(upload_id: int, body: UploadConfirmRequest, session: Session = Depends(get_session)):
    """Conferma umana obbligatoria (docs/SPEC.md §9 punto 8) — l'unico
    endpoint che invia davvero l'upload al tracker (passo 9) e, a esito
    riuscito, aggiunge il .torrent al client locale per seedare subito
    (passo 10, force_recheck=True invariato, mai skip_checking)."""
    job = _get_upload_or_404(session, upload_id)
    if job.status != "ready":
        raise HTTPException(
            status_code=400, detail=f"upload_job in stato {job.status!r}, atteso 'ready' (esegui prima /prepare)"
        )
    tracker = _get_tracker_or_404(session, job.tracker_id)
    profile = session.get(TrackerUploadProfile, tracker.id)
    if profile is None:
        raise HTTPException(status_code=400, detail=f"Tracker {tracker.label!r} non ha un profilo di upload")
    tracker_adapter = adapter_factory.build_tracker_adapter(tracker)

    try:
        job = upload.submit(session, job, tracker_adapter, profile)
    except UploadPreparationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UploadError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    torrent_client = session.get(TorrentClient, body.torrent_client_id)
    if torrent_client is None:
        raise HTTPException(status_code=404, detail=f"TorrentClient {body.torrent_client_id} non trovato")
    try:
        client_adapter = adapter_factory.build_torrent_client_adapter(torrent_client)
        import os

        client_adapter.add_torrent(job.torrent_path, save_path=os.path.dirname(job.source_path), force_recheck=True)
    except Exception:
        logger.exception(
            "Upload %s riuscito sul tracker ma add_torrent al client fallito: va aggiunto manualmente", job.id
        )
    return UploadResponse.from_model(job)
