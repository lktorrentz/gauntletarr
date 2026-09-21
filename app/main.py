from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db
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

# API JSON pura sotto /api/* fin dall'inizio (docs/SPEC.md §10) — i router
# per dischi/media path/tracker/client (Fase 1-2) e il resto si aggiungono
# man mano, ciascuno con app.include_router(..., prefix="/api").


@app.get("/api/health")
def health():
    return {"status": "ok"}
