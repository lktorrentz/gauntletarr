"""Modelli SQLAlchemy che mappano le tabelle create da docs/schema.sql.

docs/schema.sql resta la fonte di verità per la DDL (vedi app/db.py). Questi
modelli non generano schema (niente Base.metadata.create_all): servono solo
per l'accesso ORM, e vanno tenuti manualmente in sync con schema.sql quando
quest'ultimo cambia.

Fase 0 (docs/ROADMAP.md): solo le tabelle di CONFIGURAZIONE. Le entità
fisiche (media_file/seed_file), client torrent (client_torrent/
client_torrent_file), dominio (media_item/candidate/match_review/seed_job)
e upload arrivano nei rispettivi modelli man mano che le fasi 1-6 le usano
davvero — esistono già come tabelle vuote in schema.sql, ma mapparle in ORM
prima di avere codice che le usa sarebbe un'astrazione prematura.
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
