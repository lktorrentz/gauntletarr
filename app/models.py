"""Modelli SQLAlchemy che mappano le tabelle create da docs/schema.sql.

docs/schema.sql resta la fonte di verità per la DDL (vedi app/db.py). Questi
modelli non generano schema (niente Base.metadata.create_all): servono solo
per l'accesso ORM, e vanno tenuti manualmente in sync con schema.sql quando
quest'ultimo cambia.

Fase 0 (docs/ROADMAP.md): solo le tabelle di CONFIGURAZIONE. Fase 1
aggiunge run_log e le tabelle FISICO (media_file/seed_file). Client
torrent (client_torrent/client_torrent_file), dominio (media_item/
candidate/match_review/seed_job) e upload arrivano nei rispettivi modelli
man mano che le fasi 2-6 le usano davvero — esistono già come tabelle
vuote in schema.sql, ma mapparle in ORM prima di avere codice che le usa
sarebbe un'astrazione prematura.
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


# ============ FISICO (scritto SOLO dal processo di scan, app/scanner.py — Fase 1) ============


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
    media_item_id: Mapped[int | None]  # FK a media_item(id) — mappata dalla Fase 3, colonna già in schema.sql
    resolver_source: Mapped[str | None]
    mediainfo_unique_id: Mapped[str | None]
    last_scan_id: Mapped[int] = mapped_column(ForeignKey("run_log.id"), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(nullable=False)


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
