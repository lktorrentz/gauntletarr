"""Fase 1 — definition of done (docs/ROADMAP.md): dato un disco con path
media e torrent reali, l'app produce correttamente la lista di file
con/senza hardlink.
"""

import os

from app import library, pipeline, scanner
from app.models import Disk, MediaFile, MediaPath


def _make_disk(db_session, tmp_path, torrents_rel_path="torrents"):
    root = tmp_path / "disk1"
    (root / "media" / "movies").mkdir(parents=True)
    (root / torrents_rel_path).mkdir(parents=True)

    disk = Disk(label="disk1", root_path=str(root), torrents_rel_path=torrents_rel_path)
    db_session.add(disk)
    db_session.commit()

    media_path = MediaPath(disk_id=disk.id, relative_path="media/movies", content_type="movie")
    db_session.add(media_path)
    db_session.commit()

    return disk, media_path, root


def _run_scan(db_session, disk):
    run = pipeline.start_run(db_session, run_type="bulk_import")
    counts = scanner.scan_disk(db_session, disk, run)
    return run, counts


def test_hardlinked_file_is_linked(db_session, tmp_path):
    # Lo scanner rileva solo l'hardlink (seed_file.media_file_id) — lo stato
    # "seeding" completo richiede anche il tracciamento del client (Fase 2,
    # vedi tests/test_library_states.py), qui deliberatamente non configurato.
    disk, _media_path, root = _make_disk(db_session, tmp_path)

    media_file_path = root / "media" / "movies" / "Movie.2024.mkv"
    media_file_path.write_bytes(b"fake video content")
    torrent_file_path = root / "torrents" / "Movie.2024.mkv"
    os.link(media_file_path, torrent_file_path)  # hardlink reale, stesso inode

    _run_scan(db_session, disk)

    media_states = library.media_file_states(db_session)
    seed_states = library.seed_file_states(db_session)

    assert len(media_states) == 1
    assert len(seed_states) == 1
    assert seed_states[0]["media_file_id"] == media_states[0]["id"]
    # Senza un client configurato, nessun file può essere "seeding" a tutti gli effetti.
    assert media_states[0]["state"] == "orphan_media"
    assert seed_states[0]["state"] == "orphan_torrent"


def test_media_file_without_hardlink_is_orphan(db_session, tmp_path):
    disk, _media_path, root = _make_disk(db_session, tmp_path)

    (root / "media" / "movies" / "Lonely.2024.mkv").write_bytes(b"no link for me")

    _run_scan(db_session, disk)

    media_states = library.media_file_states(db_session)
    assert len(media_states) == 1
    assert media_states[0]["state"] == "orphan_media"


def test_seed_file_without_media_counterpart_is_orphan_torrent(db_session, tmp_path):
    disk, _media_path, root = _make_disk(db_session, tmp_path)

    (root / "torrents" / "Standalone.2024.mkv").write_bytes(b"seeding but not in library")

    _run_scan(db_session, disk)

    seed_states = library.seed_file_states(db_session)
    assert len(seed_states) == 1
    assert seed_states[0]["state"] == "orphan_torrent"
    assert seed_states[0]["media_file_id"] is None


def test_non_video_extension_ignored_on_media_side(db_session, tmp_path):
    disk, _media_path, root = _make_disk(db_session, tmp_path)

    (root / "media" / "movies" / "readme.txt").write_bytes(b"not a video")

    _run_scan(db_session, disk)

    assert library.media_file_states(db_session) == []


def test_non_video_file_on_torrent_side_is_still_indexed(db_session, tmp_path):
    # Lato torrent NON filtriamo per estensione (sottotitoli/nfo/sample
    # fanno parte del torrent, servono dalla Fase 2 per client_torrent_file).
    disk, _media_path, root = _make_disk(db_session, tmp_path)

    (root / "torrents" / "movie.srt").write_bytes(b"subtitle")

    _run_scan(db_session, disk)

    seed_states = library.seed_file_states(db_session)
    assert len(seed_states) == 1
    assert seed_states[0]["relative_path"] == os.path.join("torrents", "movie.srt")


def test_rescanning_does_not_duplicate_rows(db_session, tmp_path):
    disk, _media_path, root = _make_disk(db_session, tmp_path)

    media_file_path = root / "media" / "movies" / "Movie.2024.mkv"
    media_file_path.write_bytes(b"fake video content")
    os.link(media_file_path, root / "torrents" / "Movie.2024.mkv")

    _run_scan(db_session, disk)
    _second_run, second_counts = _run_scan(db_session, disk)

    media_states = library.media_file_states(db_session)
    seed_states = library.seed_file_states(db_session)
    assert len(media_states) == 1
    assert len(seed_states) == 1
    assert seed_states[0]["media_file_id"] == media_states[0]["id"]
    # 1 media_file + 1 seed_file ri-scansionati, non duplicati (upsert su disk_id+relative_path)
    assert second_counts == {"media_files_scanned": 1, "seed_files_scanned": 1}


def test_disk_without_torrents_rel_path_only_scans_media(db_session, tmp_path):
    root = tmp_path / "disk2"
    (root / "media" / "movies").mkdir(parents=True)
    disk = Disk(label="disk2", root_path=str(root))  # torrents_rel_path non configurato
    db_session.add(disk)
    db_session.commit()
    media_path = MediaPath(disk_id=disk.id, relative_path="media/movies", content_type="movie")
    db_session.add(media_path)
    db_session.commit()

    (root / "media" / "movies" / "Movie.2024.mkv").write_bytes(b"content")

    _run_scan(db_session, disk)

    assert len(library.media_file_states(db_session)) == 1
    assert library.seed_file_states(db_session) == []


def test_scan_populates_content_hash(db_session, tmp_path):
    disk, _media_path, root = _make_disk(db_session, tmp_path)
    (root / "media" / "movies" / "Movie.2024.mkv").write_bytes(b"fake video content")

    _run_scan(db_session, disk)

    mf = db_session.query(MediaFile).one()
    assert mf.content_hash is not None
