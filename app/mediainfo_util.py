"""Calcolo dell'Unique ID mediainfo per un file locale.

Vedi docs/SPEC.md sezione 6: confrontato con l'Unique ID pubblicato dal
tracker (candidate.mediainfo_match). Calcolato on-demand — solo per i
candidati che hanno già superato il confronto dimensione — e cachato in
media_file.mediainfo_unique_id (vedi app/matching.py).
"""

import logging
import re

from pymediainfo import MediaInfo

logger = logging.getLogger(__name__)

_LEADING_TOKEN_RE = re.compile(r"^(\S+)")


def compute_unique_id(file_path: str) -> str | None:
    """Ritorna None se mediainfo non riesce a leggere il file o non
    espone un Unique ID (es. cartella BDMV multi-file) — mai un'eccezione
    che blocchi il motore di matching."""
    try:
        media_info = MediaInfo.parse(file_path)
    except Exception:
        logger.exception("mediainfo fallito su %r", file_path)
        return None

    for track in media_info.general_tracks:
        raw = getattr(track, "unique_id", None)
        if raw:
            # stesso formato "<decimale> (0x...)" osservato nell'output
            # testuale del tracker: normalizziamo prendendo solo il decimale.
            match = _LEADING_TOKEN_RE.match(str(raw).strip())
            return match.group(1) if match else str(raw).strip()
    return None


def extract_full_text(file_path: str) -> str | None:
    """Report mediainfo testuale completo (lo stesso formato del comando
    CLI `mediainfo`), per la sezione Mediainfo della descrizione di upload
    (docs/SPEC.md §9). output='STRING'/full=False riproduce esattamente il
    formato usato da Upload-Assistant per lo stesso scopo (verificato
    contro la sua src/exportmi.py come riferimento di dominio, nessun
    codice riusato). None solo se mediainfo non riesce proprio a leggere il
    file — mai un'eccezione che blocchi la pipeline di upload."""
    try:
        text = MediaInfo.parse(file_path, output="STRING", full=False)
    except Exception:
        logger.exception("mediainfo (testo completo) fallito su %r", file_path)
        return None
    return text or None
