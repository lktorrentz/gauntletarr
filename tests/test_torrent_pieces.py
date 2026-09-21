import hashlib

from app.torrent_pieces import verify_file_pieces


def _pieces(content: bytes, piece_length: int) -> list[bytes]:
    return [hashlib.sha1(content[i : i + piece_length]).digest() for i in range(0, len(content), piece_length)]


def test_verify_clean_single_file(tmp_path):
    content = b"0123456789abcdef" * 4  # 64 byte, 4 piece esatte
    path = tmp_path / "movie.mkv"
    path.write_bytes(content)

    result = verify_file_pieces(
        str(path), piece_length=16, pieces=_pieces(content, 16), total_length=64, file_offset=0, file_length=64
    )

    assert result.ok == 4
    assert result.mismatches == 0
    assert result.boundary == 0
    assert result.clean is True


def test_verify_detects_mismatch(tmp_path):
    content = b"0123456789abcdef" * 4
    tampered = bytearray(content)
    tampered[20] = tampered[20] ^ 0xFF  # corrompe un byte dentro la seconda piece
    path = tmp_path / "movie.mkv"
    path.write_bytes(bytes(tampered))

    result = verify_file_pieces(
        str(path), piece_length=16, pieces=_pieces(content, 16), total_length=64, file_offset=0, file_length=64
    )

    assert result.mismatches > 0
    assert result.clean is False


def test_verify_isolates_file_within_multi_file_torrent(tmp_path):
    # Torrent virtuale: file_a (16 byte) + file_b (32 byte), piece da 16 byte
    # -> 3 piece totali, tutte allineate ai confini file in questo caso.
    file_a = b"a" * 16
    file_b = b"b" * 32
    concatenated = file_a + file_b
    pieces = _pieces(concatenated, 16)

    path_b = tmp_path / "file_b.mkv"
    path_b.write_bytes(file_b)

    result = verify_file_pieces(
        str(path_b), piece_length=16, pieces=pieces, total_length=48, file_offset=16, file_length=32
    )

    assert result.ok == 2
    assert result.mismatches == 0
    assert result.boundary == 0


def test_verify_counts_boundary_pieces_not_verifiable_in_isolation(tmp_path):
    # file_a (10 byte) + file_b (10 byte), piece da 16 byte: due piece totali.
    # La prima (byte 0-15) e' a cavallo tra i due file (inizia prima di
    # file_offset=10) -> non verificabile isolando solo file_b, boundary.
    # La seconda (byte 16-19) sta interamente dentro file_b -> verificabile.
    file_a = b"a" * 10
    file_b = b"b" * 10
    concatenated = file_a + file_b
    pieces = _pieces(concatenated, 16)

    path_b = tmp_path / "file_b.mkv"
    path_b.write_bytes(file_b)

    result = verify_file_pieces(
        str(path_b), piece_length=16, pieces=pieces, total_length=20, file_offset=10, file_length=10
    )

    assert result.boundary == 1
    assert result.ok == 1
    assert result.mismatches == 0
    assert result.clean is True


def test_verify_returns_empty_result_on_missing_file():
    result = verify_file_pieces(
        "/nonexistent/path.mkv", piece_length=16, pieces=[b"x" * 20], total_length=16, file_offset=0, file_length=16
    )

    assert result.ok == 0
    assert result.mismatches == 0
    assert result.boundary == 0
    assert result.clean is False


def test_zero_length_file_returns_empty_result(tmp_path):
    path = tmp_path / "empty.mkv"
    path.write_bytes(b"")

    result = verify_file_pieces(str(path), piece_length=16, pieces=[], total_length=0, file_offset=0, file_length=0)

    assert result.clean is False
