"""Accesso a app_settings (key/value libero, docs/schema.sql — es.
tmdb_api_key, confidence_threshold_auto_*, schedule_cron)."""

from sqlalchemy.orm import Session

from app.models import AppSetting


def get_setting(session: Session, key: str) -> str | None:
    row = session.get(AppSetting, key)
    return row.value if row else None


def set_setting(session: Session, key: str, value: str) -> None:
    row = session.get(AppSetting, key)
    if row is None:
        session.add(AppSetting(key=key, value=value))
    else:
        row.value = value
    session.commit()
