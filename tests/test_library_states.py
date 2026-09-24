"""Fase 2 — definition of done (docs/ROADMAP.md): con qBittorrent (qui un
adapter fittizio con la stessa interfaccia) + un secondo client, lo stato
seeding/orphan_torrent/ignored è corretto. Copre le quattro combinazioni
hardlink si/no x tracciato-dal-client si/no.
"""

import os

from app import library, pipeline, scanner, torrent_indexer
from app.adapters.torrent_client.base import ClientTorrentFileInfo, ClientTorrentInfo, TorrentClientAdapter
from app.models import Disk, DiskTorrentClient, TorrentClient


class FakeAdapter(TorrentClientAdapter):
    def __init__(self, torrents):
        self._torrents = torrents

    def add_torrent(self, *args, **kwargs):
        raise NotImplementedError

    def get_torrent_status(self, *args, **kwargs):
        raise NotImplementedError

    def list_torrents(self):
        return self._torrents


def test_four_state_combinations(db_session, tmp_path):
    root = tmp_path / "disk1"
    (root / "media" / "movies").mkdir(parents=True)
    (root / "torrents").mkdir(parents=True)

    disk = Disk(label="disk1", root_path=str(root), media_rel_path="media/movies", torrents_rel_path="torrents")
    db_session.add(disk)
    db_session.commit()

    tc = TorrentClient(label="qbt", adapter_type="qbittorrent", base_url="http://qbt")
    db_session.add(tc)
    db_session.commit()
    db_session.add(DiskTorrentClient(disk_id=disk.id, torrent_client_id=tc.id))
    db_session.commit()

    # 1) hardlinkato + tracciato -> seeding
    seeding_media = root / "media" / "movies" / "Seeding.mkv"
    seeding_media.write_bytes(b"a")
    os.link(seeding_media, root / "torrents" / "Seeding.mkv")

    # 2) hardlinkato ma NON tracciato dal client -> orphan_torrent (client ha perso il torrent)
    lost_media = root / "media" / "movies" / "Lost.mkv"
    lost_media.write_bytes(b"b")
    os.link(lost_media, root / "torrents" / "Lost.mkv")

    # 3) tracciato ma senza hardlink verso la libreria -> ignored
    (root / "torrents" / "NotInLibrary.mkv").write_bytes(b"c")

    # 4) né hardlinkato né tracciato -> orphan_torrent
    (root / "torrents" / "Nobody.mkv").write_bytes(b"d")

    run = pipeline.start_run(db_session, run_type="manual")
    scanner.scan_disk(db_session, disk, run)

    adapter = FakeAdapter([
        ClientTorrentInfo(
            info_hash="h-seeding", name="Seeding.mkv", save_path=str(root / "torrents"), state="uploading",
            files=[ClientTorrentFileInfo(path_in_torrent="Seeding.mkv", size_bytes=1)],
        ),
        ClientTorrentInfo(
            info_hash="h-not-in-library", name="NotInLibrary.mkv", save_path=str(root / "torrents"), state="uploading",
            files=[ClientTorrentFileInfo(path_in_torrent="NotInLibrary.mkv", size_bytes=1)],
        ),
        # "Lost.mkv" e "Nobody.mkv" deliberatamente assenti: il client non li conosce.
    ])
    torrent_indexer.index_torrent_client(db_session, tc, adapter, run)

    seed_states = {s["relative_path"]: s["state"] for s in library.seed_file_states(db_session)}
    media_states = {s["relative_path"]: s["state"] for s in library.media_file_states(db_session)}

    assert seed_states[os.path.join("torrents", "Seeding.mkv")] == "seeding"
    assert seed_states[os.path.join("torrents", "Lost.mkv")] == "orphan_torrent"
    assert seed_states[os.path.join("torrents", "NotInLibrary.mkv")] == "ignored"
    assert seed_states[os.path.join("torrents", "Nobody.mkv")] == "orphan_torrent"

    assert media_states[os.path.join("media", "movies", "Seeding.mkv")] == "seeding"
    # Hardlinkato ma il client non lo traccia più: dal lato media non è "seeding" a
    # tutti gli effetti (docs/SPEC.md sezione 3 richiede hardlink E tracciamento client).
    assert media_states[os.path.join("media", "movies", "Lost.mkv")] == "orphan_media"


def test_a_stopped_torrent_is_still_seeding_but_flagged_stopped(db_session, tmp_path):
    root = tmp_path / "disk1"
    (root / "media").mkdir(parents=True)
    (root / "torrents").mkdir(parents=True)
    disk = Disk(label="disk1", root_path=str(root), media_rel_path="media", torrents_rel_path="torrents")
    tc = TorrentClient(label="qbt", adapter_type="qbittorrent", base_url="http://qbt")
    db_session.add_all([disk, tc])
    db_session.commit()
    for name in ("Stopped.mkv", "CrossSeeded.mkv"):
        (root / "media" / name).write_bytes(name.encode())
        os.link(root / "media" / name, root / "torrents" / name)
    run = pipeline.start_run(db_session, run_type="manual")
    scanner.scan_disk(db_session, disk, run)

    def torrent(info_hash, name, state):
        return ClientTorrentInfo(info_hash=info_hash, name=name, save_path=str(root / "torrents"), state=state,
                                 files=[ClientTorrentFileInfo(path_in_torrent=name, size_bytes=1)])

    torrent_indexer.index_torrent_client(db_session, tc, FakeAdapter([
        torrent("h1", "Stopped.mkv", "stoppedUP"),
        torrent("h2", "CrossSeeded.mkv", "pausedUP"),
    ]), run)
    tc2 = TorrentClient(label="other", adapter_type="qbittorrent", base_url="http://other")
    db_session.add(tc2)
    db_session.commit()
    active_elsewhere = FakeAdapter([torrent("h3", "CrossSeeded.mkv", "uploading")])
    torrent_indexer.index_torrent_client(db_session, tc2, active_elsewhere, run)

    media = {os.path.basename(s["relative_path"]): s for s in library.media_file_states(db_session)}
    seeds = {os.path.basename(s["relative_path"]): s for s in library.seed_file_states(db_session)}

    assert (media["Stopped.mkv"]["state"], media["Stopped.mkv"]["stopped"]) == ("seeding", True)
    assert seeds["Stopped.mkv"]["stopped"] is True
    # Fermo in un client ma attivo in un altro: condivide, quindi non "stopped".
    assert (media["CrossSeeded.mkv"]["state"], media["CrossSeeded.mkv"]["stopped"]) == ("seeding", False)
