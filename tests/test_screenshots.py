"""Richiede il binario ffmpeg reale (nessun mock: la generazione di uno
screenshot è I/O binario, non ha senso mockare ffmpeg stesso). Skippato se
ffmpeg non è installato nell'ambiente che esegue i test — presente nel
Dockerfile di produzione, non garantito ovunque in dev/CI."""

import os
import shutil
import subprocess

import pytest

from app.screenshots import ScreenshotError, generate_screenshots

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="richiede il binario ffmpeg")


def _make_test_video(path, duration=6):
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", f"testsrc=duration={duration}:size=160x120:rate=5",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", str(path),
        ],
        check=True, capture_output=True,
    )


def test_generate_screenshots_creates_requested_count(tmp_path):
    video = tmp_path / "video.mp4"
    _make_test_video(video)

    paths = generate_screenshots(str(video), str(tmp_path / "shots"), count=3)

    assert len(paths) == 3
    for p in paths:
        assert os.path.isfile(p)
        assert os.path.getsize(p) > 0


def test_generate_screenshots_raises_on_undecodable_file(tmp_path):
    fake_video = tmp_path / "not_a_video.mp4"
    fake_video.write_bytes(b"not actually a video file" * 10)

    with pytest.raises(ScreenshotError):
        generate_screenshots(str(fake_video), str(tmp_path / "shots"))
