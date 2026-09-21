"""Modelli SQLAlchemy che mappano le tabelle create da docs/schema.sql.

docs/schema.sql resta la fonte di verità per la DDL (vedi app/db.py). Questi
modelli non generano schema (niente Base.metadata.create_all): servono solo
per l'accesso ORM, e vanno tenuti manualmente in sync con schema.sql quando
quest'ultimo cambia.

Fase 0 (docs/ROADMAP.md): solo le tabelle di CONFIGURAZIONE. Fase 1
aggiunge run_log e le tabelle FISICO (media_file/seed_file). Fase 2
aggiunge CLIENT TORRENT (client_torrent/client_torrent_file). Fase 3
aggiunge media_item (identità logica). Fase 4 aggiunge DOMINIO (candidate/
match_review/seed_job). Upload arriva nei rispettivi modelli quando la
Fase 6 lo usa davvero — esiste già come tabelle vuote in schema.sql, ma
mapparle in ORM prima di avere codice che le usa sarebbe un'astrazione
prematura.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import String, TypeDecorator

from app import crypto


class Base(DeclarativeBase):
    pass


class EncryptedString(TypeDecorator):
    """Cifra/decifra trasparentemente i segreti salvati a riposo (api_token,
    password) — vedi app/crypto.py e docs/schema.sql."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return crypto.encrypt(value)

    def process_result_value(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return crypto.decrypt(value)


# ============ CONFIGURAZIONE ============


class Disk(Base):
    __tablename__ = "disk"

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(nullable=False)
    root_path: Mapped[str] = mapped_column(nullable=False, unique=True)
    st_dev: Mapped[int | None]
    torrents_rel_path: Mapped[str | None]
    torrent_client_root_path: Mapped[str | None]
    created_at: Mapped[datetime | None] = mapped_column(server_default=text("CURRENT_TIMESTAMP"))

    media_paths: Mapped[list["MediaPath"]] = relationship(
        back_populates="disk", cascade="all, delete-orphan"
    )
    torrent_clients: Mapped[list["TorrentClient"]] = relationship(
        secondary="disk_torrent_client", back_populates="disks"
    )


class MediaPath(Base):
    __tablename__ = "media_path"
    __table_args__ = (
        UniqueConstraint("disk_id", "relative_path"),
        CheckConstraint("content_type IN ('movie','tv')", name="ck_media_path_content_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    disk_id: Mapped[int] = mapped_column(ForeignKey("disk.id", ondelete="CASCADE"), nullable=False)
    relative_path: Mapped[str] = mapped_column(nullable=False)
    content_type: Mapped[str] = mapped_column(nullable=False)
    enabled: Mapped[bool] = mapped_column(nullable=False, server_default=text("1"))
    new_torrent_rel_path: Mapped[str | None]

    disk: Mapped["Disk"] = relationship(back_populates="media_paths")

    @property
    def effective_new_torrent_rel_path(self) -> str | None:
        """Cartella dove va creato un NUOVO hardlink per questa libreria (e
        il save_path da comunicare al client) se configurata, altrimenti
        quella del disco (vedi docs/SPEC.md, ereditato da ratio-guardian
        §3). Riguarda SOLO dove posizionare cose nuove: la ricerca "già in
        seeding" resta sempre sull'intera disk.torrents_rel_path."""
        return self.new_torrent_rel_path or self.disk.torrents_rel_path


class Tracker(Base):
    __tablename__ = "tracker"
    __table_args__ = (
        CheckConstraint("history_mode IN ('api','scrape','unsupported')", name="ck_tracker_history_mode"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(nullable=False)
    adapter_type: Mapped[str] = mapped_column(nullable=False)
    base_url: Mapped[str] = mapped_column(nullable=False)
    api_token: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    history_mode: Mapped[str] = mapped_column(nullable=False, server_default=text("'unsupported'"))
    history_session_cookie: Mapped[str | None]
    rate_limit_per_min: Mapped[int | None] = mapped_column(server_default=text("30"))
    enabled: Mapped[bool] = mapped_column(nullable=False, server_default=text("1"))


class TorrentClient(Base):
    __tablename__ = "torrent_client"

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(nullable=False)
    adapter_type: Mapped[str] = mapped_column(nullable=False)  # qbittorrent | deluge | transmission | rutorrent | qui
    base_url: Mapped[str] = mapped_column(nullable=False)
    username: Mapped[str | None]
    password: Mapped[str | None] = mapped_column(EncryptedString)
    enabled: Mapped[bool] = mapped_column(nullable=False, server_default=text("1"))

    disks: Mapped[list["Disk"]] = relationship(
        secondary="disk_torrent_client", back_populates="torrent_clients"
    )


class DiskTorrentClient(Base):
    """Tabella ponte: un disco può avere più client torrent abilitati
    contemporaneamente (docs/SPEC.md §5)."""

    __tablename__ = "disk_torrent_client"

    disk_id: Mapped[int] = mapped_column(ForeignKey("disk.id", ondelete="CASCADE"), primary_key=True)
    torrent_client_id: Mapped[int] = mapped_column(
        ForeignKey("torrent_client.id", ondelete="CASCADE"), primary_key=True
    )


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[str] = mapped_column(nullable=False)


# ============ RUN LOG ============


class RunLog(Base):
    __tablename__ = "run_log"
    __table_args__ = (
        CheckConstraint("run_type IN ('scheduled','manual','bulk_import')", name="ck_run_log_run_type"),
        CheckConstraint(
            "current_phase IS NULL OR current_phase IN ('scanning','matching','executing')",
            name="ck_run_log_current_phase",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    run_type: Mapped[str] = mapped_column(nullable=False)
    started_at: Mapped[datetime] = mapped_column(nullable=False)
    finished_at: Mapped[datetime | None]
    current_phase: Mapped[str | None]
    phase_total: Mapped[int | None]
    phase_done: Mapped[int | None]
    items_total: Mapped[int | None]
    items_scanned: Mapped[int] = mapped_column(server_default=text("0"))
    matches_found: Mapped[int] = mapped_column(server_default=text("0"))
    auto_executed: Mapped[int] = mapped_column(server_default=text("0"))
    pending_review: Mapped[int] = mapped_column(server_default=text("0"))
    orphan_torrent_count: Mapped[int] = mapped_column(server_default=text("0"))
    ignored_count: Mapped[int] = mapped_column(server_default=text("0"))
    health_snapshot: Mapped[float | None]
    errors: Mapped[int] = mapped_column(server_default=text("0"))


# ============ FISICO (scritto SOLO dal processo di scan, app/scanner.py) ============


class MediaItem(Base):
    """Identità logica risolta — separata dal file fisico (MediaFile)
    perché la vista a griglia (Fase 4) deve raggruppare più file fisici
    (episodi di una stagione, più versioni) sotto un solo poster."""

    __tablename__ = "media_item"
    __table_args__ = (CheckConstraint("content_type IN ('movie','tv')", name="ck_media_item_content_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    content_type: Mapped[str] = mapped_column(nullable=False)
    tmdb_id: Mapped[int] = mapped_column(nullable=False)
    season_number: Mapped[int | None]
    episode_number: Mapped[int | None]
    tmdb_poster_path: Mapped[str | None]
    created_at: Mapped[datetime | None] = mapped_column(server_default=text("CURRENT_TIMESTAMP"))


class MediaFile(Base):
    __tablename__ = "media_file"
    __table_args__ = (UniqueConstraint("disk_id", "relative_path"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    media_path_id: Mapped[int] = mapped_column(ForeignKey("media_path.id", ondelete="CASCADE"), nullable=False)
    disk_id: Mapped[int] = mapped_column(ForeignKey("disk.id", ondelete="CASCADE"), nullable=False)
    relative_path: Mapped[str] = mapped_column(nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    st_dev: Mapped[int] = mapped_column(nullable=False)
    inode: Mapped[int] = mapped_column(nullable=False)
    nlink: Mapped[int | None]
    media_item_id: Mapped[int | None] = mapped_column(ForeignKey("media_item.id", ondelete="SET NULL"))
    resolver_source: Mapped[str | None]
    mediainfo_unique_id: Mapped[str | None]
    last_scan_id: Mapped[int] = mapped_column(ForeignKey("run_log.id"), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(nullable=False)

    media_path: Mapped["MediaPath"] = relationship()
    disk: Mapped["Disk"] = relationship()
    media_item: Mapped["MediaItem | None"] = relationship()


class SeedFile(Base):
    __tablename__ = "seed_file"
    __table_args__ = (UniqueConstraint("disk_id", "relative_path"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    disk_id: Mapped[int] = mapped_column(ForeignKey("disk.id", ondelete="CASCADE"), nullable=False)
    relative_path: Mapped[str] = mapped_column(nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    st_dev: Mapped[int] = mapped_column(nullable=False)
    inode: Mapped[int] = mapped_column(nullable=False)
    media_file_id: Mapped[int | None] = mapped_column(ForeignKey("media_file.id", ondelete="SET NULL"))
    last_scan_id: Mapped[int] = mapped_column(ForeignKey("run_log.id"), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(nullable=False)

    media_file: Mapped["MediaFile | None"] = relationship()
    disk: Mapped["Disk"] = relationship()


# ============ CLIENT TORRENT (multi-istanza, scritto SOLO da app/torrent_indexer.py — Fase 2) ============


class ClientTorrent(Base):
    __tablename__ = "client_torrent"
    __table_args__ = (UniqueConstraint("torrent_client_id", "info_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    torrent_client_id: Mapped[int] = mapped_column(ForeignKey("torrent_client.id", ondelete="CASCADE"), nullable=False)
    info_hash: Mapped[str] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    save_path: Mapped[str] = mapped_column(nullable=False)
    category: Mapped[str | None]
    tracker_url: Mapped[str | None]
    state: Mapped[str] = mapped_column(nullable=False)  # valore nativo del client, non normalizzato qui
    added_at: Mapped[datetime | None]
    last_polled_at: Mapped[datetime] = mapped_column(nullable=False)


class ClientTorrentFile(Base):
    __tablename__ = "client_torrent_file"
    __table_args__ = (UniqueConstraint("client_torrent_id", "path_in_torrent"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    client_torrent_id: Mapped[int] = mapped_column(
        ForeignKey("client_torrent.id", ondelete="CASCADE"), nullable=False
    )
    path_in_torrent: Mapped[str] = mapped_column(nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    seed_file_id: Mapped[int | None] = mapped_column(ForeignKey("seed_file.id", ondelete="SET NULL"))
    last_scan_id: Mapped[int] = mapped_column(ForeignKey("run_log.id"), nullable=False)


# ============ DOMINIO — matching e reseeding (Fase 4, docs/SPEC.md sezione 6-8) ============


class Candidate(Base):
    __tablename__ = "candidate"
    __table_args__ = (
        CheckConstraint("source IN ('history','catalog_search')", name="ck_candidate_source"),
        CheckConstraint(
            "direction IN ('media_to_torrent','torrent_to_client')", name="ck_candidate_direction"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    media_item_id: Mapped[int] = mapped_column(ForeignKey("media_item.id", ondelete="CASCADE"), nullable=False)
    tracker_id: Mapped[int] = mapped_column(ForeignKey("tracker.id"), nullable=False)
    torrent_id_remote: Mapped[str] = mapped_column(nullable=False)
    info_hash: Mapped[str | None]
    name: Mapped[str] = mapped_column(nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    file_list_json: Mapped[str | None]
    folder: Mapped[str | None]
    download_link: Mapped[str | None]
    source: Mapped[str] = mapped_column(nullable=False)
    direction: Mapped[str] = mapped_column(nullable=False)
    size_match: Mapped[bool | None]
    mediainfo_match: Mapped[bool | None]
    piece_verified: Mapped[bool | None]
    piece_boundary_count: Mapped[int | None]
    confidence: Mapped[float] = mapped_column(nullable=False)
    ambiguity_reason: Mapped[str | None]
    created_at: Mapped[datetime | None] = mapped_column(server_default=text("CURRENT_TIMESTAMP"))

    media_item: Mapped["MediaItem"] = relationship()
    tracker: Mapped["Tracker"] = relationship()


class MatchReview(Base):
    __tablename__ = "match_review"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','approved','rejected','auto_approved')", name="ck_match_review_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidate.id", ondelete="CASCADE"), nullable=False)
    media_file_id: Mapped[int | None] = mapped_column(ForeignKey("media_file.id", ondelete="CASCADE"))
    seed_file_id: Mapped[int | None] = mapped_column(ForeignKey("seed_file.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(nullable=False, server_default=text("'pending'"))
    decided_by: Mapped[str | None]
    decided_at: Mapped[datetime | None]

    candidate: Mapped["Candidate"] = relationship()
    media_file: Mapped["MediaFile | None"] = relationship()
    seed_file: Mapped["SeedFile | None"] = relationship()


class SeedJob(Base):
    __tablename__ = "seed_job"
    __table_args__ = (
        CheckConstraint(
            "recheck_status IS NULL OR recheck_status IN ('pending','ok','failed')",
            name="ck_seed_job_recheck_status",
        ),
        CheckConstraint(
            "final_status IN ('in_progress','seeding','failed','rolled_back')", name="ck_seed_job_final_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidate.id", ondelete="CASCADE"), nullable=False)
    source_media_file_id: Mapped[int | None] = mapped_column(ForeignKey("media_file.id"))
    source_seed_file_id: Mapped[int | None] = mapped_column(ForeignKey("seed_file.id"))
    result_seed_file_id: Mapped[int | None] = mapped_column(ForeignKey("seed_file.id"))
    result_client_torrent_id: Mapped[int | None] = mapped_column(ForeignKey("client_torrent.id"))
    info_hash: Mapped[str | None]
    hardlink_created_at: Mapped[datetime | None]
    torrent_added_at: Mapped[datetime | None]
    recheck_status: Mapped[str | None]
    final_status: Mapped[str] = mapped_column(nullable=False, server_default=text("'in_progress'"))
    error_message: Mapped[str | None]

    candidate: Mapped["Candidate"] = relationship()
