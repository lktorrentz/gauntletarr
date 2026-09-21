"""Generazione screenshot per l'upload (docs/SPEC.md §9, Fase 6) — v1 già
la include, non rimandata. ffmpeg-python, richiede il binario `ffmpeg` nel
container (aggiunto al Dockerfile in questa stessa fase)."""

import logging
import os

import ffmpeg
from pymediainfo import MediaInfo

logger = logging.getLogger(__name__)


class ScreenshotError(Exception):
    pass


def _get_duration_seconds(file_path: str) -> float:
    media_info = MediaInfo.parse(file_path)
    for track in media_info.video_tracks:
        if track.duration:
            return float(track.duration) / 1000.0
    raise ScreenshotError(f"Durata video non determinabile per {file_path!r}")


def generate_screenshots(video_path: str, output_dir: str, count: int = 4) -> list[str]:
    """Cattura `count` frame equidistanti, escludendo il primo/ultimo 5%
    della durata (titoli/loghi/nero in apertura o coda). Un frame singolo
    che fallisce viene saltato, non blocca gli altri — solleva
    ScreenshotError solo se NESSUN frame riesce (pochi screenshot sono
    comunque meglio di un upload bloccato del tutto)."""
    os.makedirs(output_dir, exist_ok=True)
    duration = _get_duration_seconds(video_path)

    margin = duration * 0.05
    usable = duration - 2 * margin
    if usable <= 0:
        margin, usable = 0.0, duration

    paths = []
    for i in range(count):
        timestamp = margin + usable * (i + 1) / (count + 1)
        output_path = os.path.join(output_dir, f"screenshot_{i}.png")
        try:
            ffmpeg.input(video_path, ss=timestamp).output(output_path, vframes=1).overwrite_output().run(
                quiet=True, capture_stdout=True, capture_stderr=True
            )
        except ffmpeg.Error:
            logger.exception("Cattura screenshot fallita a %.1fs per %r", timestamp, video_path)
            continue
        if os.path.isfile(output_path):
            paths.append(output_path)

    if not paths:
        raise ScreenshotError(f"Nessuno screenshot generato per {video_path!r}")
    return paths
