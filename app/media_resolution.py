"""Risoluzione TMDB dei media_file (docs/SPEC.md sezione 6).

A differenza di scanner.py/torrent_indexer.py, qui non c'è un bulk upsert
possibile: ogni file richiede il proprio parsing filename + la propria
chiamata di rete a TMDB, quindi è legittimamente un'operazione per-file.
Il dedup avviene a livello di media_item (stesso tmdb_id/season/episode
riusa la stessa riga, get_or_create_media_item), non a livello di query.
"""

import logging
import os

from sqlalchemy.orm import Session

from app.adapters.media_resolver.base import MediaResolverAdapter, ResolvedMedia
from app.exclusions import load_exclusions
from app.models import MediaFile, MediaItem
from app.poster_cache import download_poster

logger = logging.getLogger(__name__)


def get_or_create_media_item(session: Session, resolved: ResolvedMedia) -> MediaItem:
    query = session.query(MediaItem).filter_by(content_type=resolved.content_type, tmdb_id=resolved.tmdb_id)
    if resolved.content_type == "tv":
        query = query.filter_by(season_number=resolved.season_number, episode_number=resolved.episode_number)
    item = query.one_or_none()
    if item is not None:
        return item

    item = MediaItem(
        content_type=resolved.content_type,
        tmdb_id=resolved.tmdb_id,
        season_number=resolved.season_number if resolved.content_type == "tv" else None,
        episode_number=resolved.episode_number if resolved.content_type == "tv" else None,
        tmdb_poster_path=resolved.poster_path,
    )
    session.add(item)
    session.commit()
    return item


def resolve_unmatched_media_files(
    session: Session, resolver: MediaResolverAdapter, posters_dir: str
) -> dict[str, int]:
    """Per ogni media_file senza media_item_id ancora, prova a risolverlo.
    Un fallimento di rete/resolver su un singolo file viene loggato e
    contato come unresolved — non deve mai far fallire l'intero giro.
    I file esclusi (Configuration > Exclusions) non vengono mai risolti:
    niente chiamate TMDB per sample, trailer e simili."""
    exclusions = load_exclusions(session)
    media_files = session.query(MediaFile).filter(MediaFile.media_item_id.is_(None)).all()
    resolved = 0
    unresolved = 0
    excluded = 0

    for mf in media_files:
        if exclusions.is_excluded(mf.relative_path):
            excluded += 1
            continue
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
                download_poster(posters_dir, result.tmdb_id, result.poster_path)
            except Exception:
                # Un poster mancante non è un errore di risoluzione — il contenuto
                # resta identificato, mostrerà solo un placeholder in UI (§6).
                logger.warning("Download poster fallito per tmdb_id=%s", result.tmdb_id, exc_info=True)

    return {"resolved": resolved, "unresolved": unresolved, "excluded": excluded}
