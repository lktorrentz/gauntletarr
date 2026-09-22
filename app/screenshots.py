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


# Catena di filtri ffmpeg per il tonemap HDR->SDR standard (algoritmo
# "mobius", lo stesso di Upload-Assistant) — senza, uno screenshot da
# sorgente HDR risulta lavato/scuro se interpretato come SDR a valle.
_HDR_TONEMAP_FILTER = (
    "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
    "tonemap=tonemap=mobius:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
)


def _get_duration_seconds(file_path: str) -> float:
    media_info = MediaInfo.parse(file_path)
    for track in media_info.video_tracks:
        if track.duration:
            return float(track.duration) / 1000.0
    raise ScreenshotError(f"Durata video non determinabile per {file_path!r}")


def generate_screenshots(video_path: str, output_dir: str, count: int = 4, tonemap: bool = False) -> list[str]:
    """Cattura `count` frame equidistanti, escludendo il primo/ultimo 5%
    della durata (titoli/loghi/nero in apertura o coda). Un frame singolo
    che fallisce viene saltato, non blocca gli altri — solleva
    ScreenshotError solo se NESSUN frame riesce (pochi screenshot sono
    comunque meglio di un upload bloccato del tutto). tonemap=True applica
    la conversione HDR->SDR (impostazione upload_tonemap_hdr)."""
    os.makedirs(output_dir, exist_ok=True)
    duration = _get_duration_seconds(video_path)

    margin = duration * 0.05
    usable = duration - 2 * margin
    if usable <= 0:
        margin, usable = 0.0, duration

    output_kwargs = {"vframes": 1}
    if tonemap:
        output_kwargs["vf"] = _HDR_TONEMAP_FILTER

    paths = []
    for i in range(count):
        timestamp = margin + usable * (i + 1) / (count + 1)
        output_path = os.path.join(output_dir, f"screenshot_{i}.png")
        try:
            ffmpeg.input(video_path, ss=timestamp).output(output_path, **output_kwargs).overwrite_output().run(
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
