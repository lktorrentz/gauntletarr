"""Risoluzione TMDB dei media_file (docs/SPEC.md sezione 6).

A differenza di scanner.py/torrent_indexer.py, qui non c'è un bulk upsert
possibile: ogni file richiede il proprio parsing filename + la propria
chiamata di rete a TMDB, quindi è legittimamente un'operazione per-file.
Il dedup avviene a livello di media_item (stesso tmdb_id/season/episode
riusa la stessa riga, get_or_create_media_item), non a livello di query.
"""

import logging
import os
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.adapters.media_resolver.base import MediaResolverAdapter, ResolvedMedia
from app.exclusions import load_exclusions
from app.file_types import is_video
from app.models import MediaFile, MediaItem
from app.poster_cache import download_poster, poster_file
from app.run_progress import NULL_PROGRESS

logger = logging.getLogger(__name__)


def get_or_create_media_item(session: Session, resolved: ResolvedMedia) -> MediaItem:
    query = session.query(MediaItem).filter_by(content_type=resolved.content_type, tmdb_id=resolved.tmdb_id)
    if resolved.content_type == "tv":
        query = query.filter_by(season_number=resolved.season_number, episode_number=resolved.episode_number)
    item = query.one_or_none()
    if item is not None:
        # Voci create prima che si salvassero titolo/anno/poster: si
        # completano con quello che la nuova risoluzione sa già.
        item.title = item.title or resolved.title
        item.year = item.year or resolved.year
        item.tmdb_poster_path = item.tmdb_poster_path or resolved.poster_path
        return item

    item = MediaItem(
        content_type=resolved.content_type,
        tmdb_id=resolved.tmdb_id,
        season_number=resolved.season_number if resolved.content_type == "tv" else None,
        episode_number=resolved.episode_number if resolved.content_type == "tv" else None,
        tmdb_poster_path=resolved.poster_path,
        title=resolved.title,
        year=resolved.year,
    )
    session.add(item)
    session.commit()
    return item


def resolve_unmatched_media_files(
    session: Session, resolver: MediaResolverAdapter, posters_dir: str, progress=NULL_PROGRESS
) -> dict[str, int]:
    """Per ogni media_file senza media_item_id ancora, prova a risolverlo.
    Un fallimento di rete/resolver su un singolo file viene loggato e
    contato come unresolved — non deve mai far fallire l'intero giro.
    I file esclusi (Configuration > Exclusions) non vengono mai risolti:
    niente chiamate TMDB per sample, trailer e simili."""
    exclusions = load_exclusions(session)
    videos = [
        mf for mf in session.query(MediaFile).filter(MediaFile.media_item_id.is_(None)).all()
        if is_video(mf.relative_path)  # nfo, sottotitoli, immagini: nessuna identità da cercare
    ]
    excluded = sum(1 for mf in videos if exclusions.is_excluded(mf.relative_path))
    media_files = [mf for mf in videos if not exclusions.is_excluded(mf.relative_path)]
    progress.add_total(len(media_files))
    resolved = 0
    unresolved = 0

    for mf in media_files:
        progress.advance()
        abs_path = os.path.join(mf.disk.root_path, mf.relative_path)
        try:
            result = resolver.resolve(abs_path)
        except Exception:
            logger.exception("Resolver fallito su %r", abs_path)
            unresolved += 1
            continue

        if result is None:
            unresolved += 1
            continue

        media_item = get_or_create_media_item(session, result)
        mf.media_item_id = media_item.id
        mf.resolver_source = result.source or resolver.SOURCE
        session.commit()
        resolved += 1

        if result.poster_path:
            try:
                download_poster(posters_dir, result.content_type, result.tmdb_id, result.poster_path)
            except Exception:
                # Un poster mancante non è un errore di risoluzione — il contenuto
                # resta identificato, mostrerà solo un placeholder in UI (§6).
                logger.warning("Download poster fallito per tmdb_id=%s", result.tmdb_id, exc_info=True)

    return {"resolved": resolved, "unresolved": unresolved, "excluded": excluded}


def complete_media_items(
    session: Session,
    posters_dir: str,
    arr_index=None,
    tmdb_details: Callable[[str, int], dict] | None = None,
    progress=NULL_PROGRESS,
) -> dict[str, int]:
    """Completa le voci senza titolo o senza poster in cache — create da
    versioni precedenti, o il cui poster non si era scaricato. Una sola
    richiesta per contenuto (tmdb_id), mai per episodio: prima Radarr/Sonarr
    (nessuna chiamata di rete verso TMDB), poi il dettaglio TMDB se c'è la
    chiave. Un errore su un contenuto lo lascia com'è per la run successiva."""
    by_content: dict[tuple[str, int], list[MediaItem]] = {}
    for item in session.query(MediaItem).all():
        missing_poster = not item.tmdb_poster_path or not os.path.exists(
            poster_file(posters_dir, item.content_type, item.tmdb_id)
        )
        if item.title is None or missing_poster:
            by_content.setdefault((item.content_type, item.tmdb_id), []).append(item)
    progress.add_total(len(by_content))
    completed = failed = 0

    for (content_type, tmdb_id), items in by_content.items():
        progress.advance()
        known = next((i for i in items if i.title), None)
        title, year = (known.title, known.year) if known else (None, None)
        poster_path = next((i.tmdb_poster_path for i in items if i.tmdb_poster_path), None)
        identity = arr_index.details_for(content_type, tmdb_id) if arr_index is not None else None
        if identity is not None:
            title, year = title or identity.title, year or identity.year
            poster_path = poster_path or identity.poster_path
        if (title is None or poster_path is None) and tmdb_details is not None:
            try:
                details = tmdb_details(content_type, tmdb_id)
            except Exception:
                logger.warning("Dettaglio TMDB fallito per %s %s", content_type, tmdb_id, exc_info=True)
                failed += 1
                continue
            title, year = title or details.get("title"), year or details.get("year")
            poster_path = poster_path or details.get("poster_path")
        for item in items:
            item.title = item.title or title
            item.year = item.year or year
            item.tmdb_poster_path = item.tmdb_poster_path or poster_path
        session.commit()
        if poster_path:
            try:
                download_poster(posters_dir, content_type, tmdb_id, poster_path)
            except Exception:
                logger.warning("Download poster fallito per %s %s", content_type, tmdb_id, exc_info=True)
        completed += 1
    return {"completed": completed, "failed": failed}

