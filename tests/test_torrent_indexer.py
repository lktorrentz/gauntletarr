from datetime import UTC, datetime

from app import pipeline, torrent_indexer
from app.adapters.torrent_client.base import ClientTorrentFileInfo, ClientTorrentInfo, TorrentClientAdapter
from app.models import ClientTorrentFile, Disk, SeedFile, TorrentClient


class FakeAdapter(TorrentClientAdapter):
    def __init__(self, torrents):
        self._torrents = torrents

    def add_torrent(self, *args, **kwargs):
        raise NotImplementedError

    def get_torrent_status(self, *args, **kwargs):
        raise NotImplementedError

    def list_torrents(self):
        return self._torrents


def _make_disk_and_client(db_session, root_path, torrent_client_root_path=None):
    disk = Disk(label="disk1", root_path=root_path, torrents_rel_path="torrents",
                torrent_client_root_path=torrent_client_root_path)
    db_session.add(disk)
    db_session.commit()

    tc = TorrentClient(label="qbt", adapter_type="qbittorrent", base_url="http://qbt")
    db_session.add(tc)
    db_session.commit()
    tc.disks.append(disk)
    db_session.commit()

    return disk, tc


def _make_seed_file(db_session, disk, relative_path, run):
    sf = SeedFile(
        disk_id=disk.id, relative_path=relative_path, size_bytes=123,
        st_dev=1, inode=1, last_scan_id=run.id, last_seen_at=datetime.now(UTC),
    )
    db_session.add(sf)
    db_session.commit()
    return sf


def test_resolves_seed_file_by_path_same_root(db_session):
    disk, tc = _make_disk_and_client(db_session, root_path="/mnt/disk1")
    run = pipeline.start_run(db_session, run_type="manual")
    seed_file = _make_seed_file(db_session, disk, "torrents/Movie.2024.mkv", run)

    adapter = FakeAdapter([
        ClientTorrentInfo(
            info_hash="h1", name="Movie.2024.mkv", save_path="/mnt/disk1/torrents", state="uploading",
            files=[ClientTorrentFileInfo(path_in_torrent="Movie.2024.mkv", size_bytes=123)],
        )
    ])

    counts = torrent_indexer.index_torrent_client(db_session, tc, adapter, run)

    assert counts == {"torrents_indexed": 1, "files_indexed": 1}
    ctf = db_session.query(ClientTorrentFile).one()
    assert ctf.seed_file_id == seed_file.id


def test_resolves_seed_file_when_client_sees_different_root(db_session):
    # Il client vede il contenuto sotto /downloads, noi sotto /mnt/disk1 —
    # stesso disco fisico, mount diversi (docs/SPEC.md sezione 4).
    disk, tc = _make_disk_and_client(db_session, root_path="/mnt/disk1", torrent_client_root_path="/downloads")
    run = pipeline.start_run(db_session, run_type="manual")
    seed_file = _make_seed_file(db_session, disk, "torrents/Movie.2024.mkv", run)

    adapter = FakeAdapter([
        ClientTorrentInfo(
            info_hash="h1", name="Movie.2024.mkv", save_path="/downloads/torrents", state="uploading",
            files=[ClientTorrentFileInfo(path_in_torrent="Movie.2024.mkv", size_bytes=123)],
        )
    ])

    torrent_indexer.index_torrent_client(db_session, tc, adapter, run)

    ctf = db_session.query(ClientTorrentFile).one()
    assert ctf.seed_file_id == seed_file.id


def test_unresolved_file_has_null_seed_file_id(db_session):
    disk, tc = _make_disk_and_client(db_session, root_path="/mnt/disk1")
    run = pipeline.start_run(db_session, run_type="manual")
    # nessun seed_file corrispondente creato

    adapter = FakeAdapter([
        ClientTorrentInfo(
            info_hash="h1", name="Ghost.mkv", save_path="/mnt/disk1/torrents", state="uploading",
            files=[ClientTorrentFileInfo(path_in_torrent="Ghost.mkv", size_bytes=1)],
        )
    ])

    torrent_indexer.index_torrent_client(db_session, tc, adapter, run)

    ctf = db_session.query(ClientTorrentFile).one()
    assert ctf.seed_file_id is None


def test_repolling_does_not_duplicate_rows(db_session):
    disk, tc = _make_disk_and_client(db_session, root_path="/mnt/disk1")
    run = pipeline.start_run(db_session, run_type="manual")
    _make_seed_file(db_session, disk, "torrents/Movie.2024.mkv", run)

    adapter = FakeAdapter([
        ClientTorrentInfo(
            info_hash="h1", name="Movie.2024.mkv", save_path="/mnt/disk1/torrents", state="uploading",
            files=[ClientTorrentFileInfo(path_in_torrent="Movie.2024.mkv", size_bytes=123)],
        )
    ])

    torrent_indexer.index_torrent_client(db_session, tc, adapter, run)
    torrent_indexer.index_torrent_client(db_session, tc, adapter, run)

    assert db_session.query(ClientTorrentFile).count() == 1


def test_client_with_no_disks_still_indexes_torrents_without_linking(db_session):
    tc = TorrentClient(label="qbt", adapter_type="qbittorrent", base_url="http://qbt")
    db_session.add(tc)
    db_session.commit()
    run = pipeline.start_run(db_session, run_type="manual")

    adapter = FakeAdapter([
        ClientTorrentInfo(
            info_hash="h1", name="Movie.mkv", save_path="/anywhere", state="uploading",
            files=[ClientTorrentFileInfo(path_in_torrent="Movie.mkv", size_bytes=1)],
        )
    ])

    counts = torrent_indexer.index_torrent_client(db_session, tc, adapter, run)

    assert counts == {"torrents_indexed": 1, "files_indexed": 1}
    assert db_session.query(ClientTorrentFile).one().seed_file_id is None
