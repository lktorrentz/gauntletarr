"""Quali file della libreria sono hardlinkati a quali file della cartella
torrent, per inode.

seed_file.media_file_id (scritto dallo scanner) collega ogni file lato
torrent a UN solo media_file con lo stesso inode: basta per l'identità del
file torrent, ma se in libreria lo stesso inode ha due percorsi (es. un
import doppio di Sonarr/Radarr) il secondo restava senza collegamento,
"orphaned" pur essendo fisicamente lo stesso file già in seed, e il
matching lo cercava sui tracker. Qui il collegamento è per
(disk_id, st_dev, inode): ogni percorso in libreria di quell'inode vede
tutti i suoi hardlink lato torrent.
"""

from collections import defaultdict

from sqlalchemy.orm import Session

from app.models import MediaFile, SeedFile


def media_links(session: Session, media_file_ids: list[int] | None = None) -> dict[int, list[tuple[int, str]]]:
    """media_file.id -> [(seed_file.id, seed_file.relative_path)]: i file lato
    torrent con lo stesso inode sullo stesso disco, più quelli già collegati
    esplicitamente (seed_file.media_file_id, scanner e app/seed_refresh.py).
    Solo i media_file con almeno un link."""
    wanted = set(media_file_ids) if media_file_ids is not None else None
    seeds: dict[tuple[int, int, int], list[tuple[int, str]]] = defaultdict(list)
    links: dict[int, dict[int, str]] = defaultdict(dict)
    for sf_id, disk_id, st_dev, inode, path, media_file_id in session.query(
        SeedFile.id, SeedFile.disk_id, SeedFile.st_dev, SeedFile.inode, SeedFile.relative_path, SeedFile.media_file_id
    ).all():
        seeds[(disk_id, st_dev, inode)].append((sf_id, path))
        if media_file_id is not None and (wanted is None or media_file_id in wanted):
            links[media_file_id][sf_id] = path
    if not seeds:
        return {}
    query = session.query(MediaFile.id, MediaFile.disk_id, MediaFile.st_dev, MediaFile.inode)
    if wanted is not None:
        query = query.filter(MediaFile.id.in_(wanted))
    for mf_id, disk_id, st_dev, inode in query.all():
        for sf_id, path in seeds.get((disk_id, st_dev, inode), ()):
            links[mf_id][sf_id] = path
    return {mf_id: sorted(sfs.items(), key=lambda item: item[1]) for mf_id, sfs in links.items()}
