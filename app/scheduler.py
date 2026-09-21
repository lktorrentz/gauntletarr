"""Scheduler in-process per le run schedulate (docs/SPEC.md §8, Fase 5).

Un solo job APScheduler ('scheduled_run'), il cui trigger cron viene letto
da app_settings alla chiave 'schedule_cron' all'avvio e può essere
riconfigurato a runtime senza restart — coerente con la regola di
configurazione dinamica di docs/SPEC.md §4 (tutto ciò che non è
disk_scan_root/data_dir vive nel DB, editabile da UI). Nessun cron
configurato = nessun job aggiunto, mai un default implicito.

BackgroundScheduler (thread proprio), non AsyncIOScheduler: il lavoro
vero (pipeline.run_bulk_import) è sincrono/bloccante (I/O filesystem,
richieste HTTP sincrone via httpx.Client) — lo stesso motivo per cui il
trigger manuale (app/api/runs.py) usa BackgroundTasks di FastAPI invece
di una coroutine.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import sessionmaker

from app import pipeline, settings_repo

logger = logging.getLogger(__name__)

JOB_ID = "scheduled_run"
SETTING_KEY = "schedule_cron"


def _run_scheduled(session_factory: sessionmaker, data_dir: str) -> None:
    session = session_factory()
    try:
        run = pipeline.start_run(session, run_type="scheduled")
        pipeline.run_bulk_import(session, run, data_dir)
    except Exception:
        # Non deve mai far morire il thread dello scheduler: un ciclo
        # fallito non deve impedire il prossimo (docs/ROADMAP.md Fase 5,
        # "diverse esecuzioni consecutive senza intervento manuale").
        logger.exception("Run schedulata fallita")
    finally:
        session.close()


def _add_job(scheduler: BackgroundScheduler, cron_expr: str, session_factory: sessionmaker, data_dir: str) -> None:
    scheduler.add_job(
        _run_scheduled,
        CronTrigger.from_crontab(cron_expr),
        args=[session_factory, data_dir],
        id=JOB_ID,
        replace_existing=True,
    )


def build_scheduler(session_factory: sessionmaker, data_dir: str) -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    with session_factory() as session:
        cron_expr = settings_repo.get_setting(session, SETTING_KEY)
    if cron_expr:
        _add_job(scheduler, cron_expr, session_factory, data_dir)
    return scheduler


def reschedule(
    scheduler: BackgroundScheduler, cron_expr: str | None, session_factory: sessionmaker, data_dir: str
) -> None:
    """Riconfigura (o rimuove, se cron_expr è vuoto/None) il job schedulato
    a runtime, chiamata da app/api/schedule.py dopo un aggiornamento."""
    if scheduler.get_job(JOB_ID) is not None:
        scheduler.remove_job(JOB_ID)
    if cron_expr:
        _add_job(scheduler, cron_expr, session_factory, data_dir)
