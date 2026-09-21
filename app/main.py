from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db, scheduler, startup_checks
from app.api.dashboard import router as dashboard_router
from app.api.disks import router as disks_router
from app.api.library import router as library_router
from app.api.media_paths import router as media_paths_router
from app.api.reviews import router as reviews_router
from app.api.runs import router as runs_router
from app.api.schedule import router as schedule_router
from app.api.settings import router as settings_router
from app.api.torrent_clients import router as torrent_clients_router
from app.api.trackers import router as trackers_router
from app.api.uploads import router as uploads_router
from app.config import load_settings
from app.logging_config import configure_logging

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    engine = db.make_engine(settings.db_path)
    db.apply_schema(engine)
    db.migrate_schema(engine)
    session_factory = db.make_session_factory(engine)
    with session_factory() as session:
        startup_checks.verify_secret_key(session)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory

    app.state.scheduler = scheduler.build_scheduler(session_factory, settings.data_dir)
    app.state.scheduler.start()
    try:
        yield
    finally:
        app.state.scheduler.shutdown(wait=False)


app = FastAPI(title="The Media Gauntlet*rr", lifespan=lifespan)

# API JSON pura sotto /api/* fin dall'inizio (docs/SPEC.md §10)
app.include_router(disks_router)
app.include_router(media_paths_router)
app.include_router(runs_router)
app.include_router(library_router)
app.include_router(torrent_clients_router)
app.include_router(settings_router)
app.include_router(trackers_router)
app.include_router(reviews_router)
app.include_router(schedule_router)
app.include_router(dashboard_router)
app.include_router(uploads_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
