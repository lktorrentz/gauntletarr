"""API di configurazione per i client torrent, multi-istanza (docs/SPEC.md
sezione 5) — un disco può avere più client abilitati contemporaneamente,
gestito dalla tabella ponte disk_torrent_client.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import adapter_factory
from app.deps import get_session
from app.models import Disk, TorrentClient

router = APIRouter(prefix="/api/torrent-clients", tags=["torrent-clients"])

# deluge/transmission/rutorrent pianificati, vedi docs/ROADMAP.md Fase 2
SUPPORTED_ADAPTER_TYPES = {"qbittorrent", "qui"}


class TorrentClientCreateRequest(BaseModel):
    label: str
    adapter_type: str
    base_url: str
    username: str | None = None
    password: str | None = None
    api_token: str | None = None  # adapter_type="qui": la sua X-API-Key
    qui_instance_id: int | None = None  # adapter_type="qui": quale istanza gestita da quel deployment


class TorrentClientUpdateRequest(BaseModel):
    label: str | None = None
    base_url: str | None = None
    username: str | None = None
    password: str | None = None
    api_token: str | None = None
    qui_instance_id: int | None = None
    enabled: bool | None = None


class TorrentClientTestResponse(BaseModel):
    status: str  # "ok" | "error"
    torrents_found: int | None = None
    error: str | None = None


class TorrentClientResponse(BaseModel):
    id: int
    label: str
    adapter_type: str
    base_url: str
    username: str | None
    qui_instance_id: int | None  # mai api_token/password: write-only, non tornano mai indietro
    enabled: bool
    disk_ids: list[int]  # dischi abilitati per questo client (Fase 8: la UI deve poterli mostrare)

    @classmethod
    def from_model(cls, tc: TorrentClient) -> "TorrentClientResponse":
        return cls(
            id=tc.id, label=tc.label, adapter_type=tc.adapter_type,
            base_url=tc.base_url, username=tc.username, qui_instance_id=tc.qui_instance_id, enabled=tc.enabled,
            disk_ids=[d.id for d in tc.disks],
        )


def _get_torrent_client_or_404(session: Session, torrent_client_id: int) -> TorrentClient:
    tc = session.get(TorrentClient, torrent_client_id)
    if tc is None:
        raise HTTPException(status_code=404, detail=f"Client torrent {torrent_client_id} non trovato")
    return tc


def _get_disk_or_404(session: Session, disk_id: int) -> Disk:
    disk = session.get(Disk, disk_id)
    if disk is None:
        raise HTTPException(status_code=404, detail=f"Disco {disk_id} non trovato")
    return disk


@router.get("", response_model=list[TorrentClientResponse])
def list_torrent_clients(session: Session = Depends(get_session)):
    return [TorrentClientResponse.from_model(tc) for tc in session.query(TorrentClient).all()]


@router.post("", response_model=TorrentClientResponse, status_code=201)
def create_torrent_client(body: TorrentClientCreateRequest, session: Session = Depends(get_session)):
    if body.adapter_type not in SUPPORTED_ADAPTER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"adapter_type non ancora implementato: {body.adapter_type!r} "
            f"(supportati: {sorted(SUPPORTED_ADAPTER_TYPES)})",
        )
    tc = TorrentClient(
        label=body.label, adapter_type=body.adapter_type, base_url=body.base_url,
        username=body.username, password=body.password,
        api_token=body.api_token, qui_instance_id=body.qui_instance_id,
    )
    session.add(tc)
    session.commit()
    return TorrentClientResponse.from_model(tc)


@router.post("/{torrent_client_id}/test", response_model=TorrentClientTestResponse)
def test_torrent_client(torrent_client_id: int, session: Session = Depends(get_session)):
    """Sola lettura: chiama adapter.list_torrents() e riporta successo/errore,
    senza bisogno di dischi configurati né di passare da uno scan completo —
    utile per verificare le credenziali subito dopo aver creato/modificato
    un client (docs/SPEC.md sezione 5)."""
    tc = _get_torrent_client_or_404(session, torrent_client_id)
    try:
        adapter = adapter_factory.build_torrent_client_adapter(tc)
        torrents = adapter.list_torrents()
    except Exception as exc:
        return TorrentClientTestResponse(status="error", error=str(exc))
    return TorrentClientTestResponse(status="ok", torrents_found=len(torrents))


@router.patch("/{torrent_client_id}", response_model=TorrentClientResponse)
def update_torrent_client(
    torrent_client_id: int, body: TorrentClientUpdateRequest, session: Session = Depends(get_session)
):
    tc = _get_torrent_client_or_404(session, torrent_client_id)
    if body.label is not None:
        tc.label = body.label
    if body.base_url is not None:
        tc.base_url = body.base_url
    if body.username is not None:
        tc.username = body.username
    if body.password is not None:
        tc.password = body.password
    if body.api_token is not None:
        tc.api_token = body.api_token
    if body.qui_instance_id is not None:
        tc.qui_instance_id = body.qui_instance_id
    if body.enabled is not None:
        tc.enabled = body.enabled
    session.commit()
    return TorrentClientResponse.from_model(tc)


@router.delete("/{torrent_client_id}", status_code=204)
def delete_torrent_client(torrent_client_id: int, session: Session = Depends(get_session)):
    tc = _get_torrent_client_or_404(session, torrent_client_id)
    session.delete(tc)
    session.commit()


@router.post("/{torrent_client_id}/disks/{disk_id}", status_code=204)
def associate_disk(torrent_client_id: int, disk_id: int, session: Session = Depends(get_session)):
    tc = _get_torrent_client_or_404(session, torrent_client_id)
    disk = _get_disk_or_404(session, disk_id)
    if disk not in tc.disks:
        tc.disks.append(disk)
        session.commit()


@router.delete("/{torrent_client_id}/disks/{disk_id}", status_code=204)
def dissociate_disk(torrent_client_id: int, disk_id: int, session: Session = Depends(get_session)):
    tc = _get_torrent_client_or_404(session, torrent_client_id)
    disk = _get_disk_or_404(session, disk_id)
    if disk in tc.disks:
        tc.disks.remove(disk)
        session.commit()
