from app.mediainfo_util import extract_full_text


def test_extract_full_text_returns_report_for_readable_file(tmp_path):
    path = tmp_path / "x.mkv"
    path.write_bytes(b"not a real video" * 50)

    text = extract_full_text(str(path))

    assert text is not None
    assert "General" in text
    assert "Complete name" in text


def test_extract_full_text_returns_none_for_missing_file():
    assert extract_full_text("/nonexistent/path/x.mkv") is None
