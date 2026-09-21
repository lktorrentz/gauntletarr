"""Cache locale dei poster TMDB (docs/SPEC.md sezione 4/6).

Scaricato una sola volta per tmdb_id, mai in DB (solo il path relativo
TMDB, media_item.tmdb_poster_path) — l'immagine vive sul filesystem sotto
data_dir/posters/{tmdb_id}.jpg.
"""

import os

import httpx

TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


def download_poster(posters_dir: str, tmdb_id: int, poster_path: str, client: httpx.Client | None = None) -> str:
    """Idempotente: se il file esiste già non lo riscarica. Ritorna il path locale."""
    os.makedirs(posters_dir, exist_ok=True)
    local_path = os.path.join(posters_dir, f"{tmdb_id}.jpg")
    if os.path.exists(local_path):
        return local_path

    owns_client = client is None
    client = client or httpx.Client(timeout=10.0)
    try:
        response = client.get(f"{TMDB_IMAGE_BASE}{poster_path}")
        response.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(response.content)
    finally:
        if owns_client:
            client.close()
    return local_path
