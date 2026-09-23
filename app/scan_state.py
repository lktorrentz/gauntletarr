"""Quali righe media_file/seed_file esistono ancora sul disco.

Lo scanner non cancella mai una riga (docs/SPEC.md §4, app/scanner.py): un
file spostato o cancellato resta con il last_scan_id dell'ultimo scan che
l'ha visto. È "attuale" solo se l'ha visto l'ultimo scan riuscito del SUO
disco — il last_scan_id più alto fra le righe di quel disco su quel lato.
Uno scan fallito non scrive righe, quindi non rende "vecchio" niente: nel
dubbio un file resta attuale, mai il contrario.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import MediaFile, SeedFile


def latest_scan_by_disk(session: Session, model: type[MediaFile] | type[SeedFile]) -> dict[int, int]:
    return dict(session.query(model.disk_id, func.max(model.last_scan_id)).group_by(model.disk_id).all())


def is_current(row: MediaFile | SeedFile, latest: dict[int, int]) -> bool:
    return row.last_scan_id == latest.get(row.disk_id, row.last_scan_id)
