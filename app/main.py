from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db
from app.api.disks import router as disks_router
from app.api.library import router as library_router
from app.api.media_paths import router as media_paths_router
from app.api.runs import router as runs_router
from app.api.torrent_clients import router as torrent_clients_router
from app.config import load_settings
from app.logging_config import configure_logging

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    engine = db.make_engine(settings.db_path)
    db.apply_schema(engine)
    db.migrate_schema(engine)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = db.make_session_factory(engine)
    yield


app = FastAPI(title="The Media Gauntlet*rr", lifespan=lifespan)

# API JSON pura sotto /api/* fin dall'inizio (docs/SPEC.md §10) — il router
# tracker (Fase 4) e il resto si aggiungono man mano, ciascuno con
# app.include_router(..., prefix="/api").
app.include_router(disks_router)
app.include_router(media_paths_router)
app.include_router(runs_router)
app.include_router(library_router)
app.include_router(torrent_clients_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
