"""Profili tracker per l'upload: file bundlati come seed data versionata
nel repo (docs/SPEC.md §9), copiati nella riga DB (tracker_upload_profile)
alla creazione — mai più riletti dal file dopo la copia, così un
aggiornamento dell'app può correggere/aggiungere profili bundlati senza
toccare l'istanza già configurata di un utente esistente."""

import json
import os

import yaml
from sqlalchemy.orm import Session

from app.models import Tracker, TrackerUploadProfile

PROFILES_DIR = os.path.join(os.path.dirname(__file__), "tracker_profiles")


class ProfileNotFoundError(FileNotFoundError):
    pass


def list_bundled_profiles() -> list[dict]:
    if not os.path.isdir(PROFILES_DIR):
        return []
    profiles = []
    for filename in sorted(os.listdir(PROFILES_DIR)):
        if not filename.endswith(".yaml"):
            continue
        with open(os.path.join(PROFILES_DIR, filename)) as f:
            data = yaml.safe_load(f)
        profiles.append({"key": data["key"], "label": data["label"], "adapter_type": data["adapter_type"]})
    return profiles


def _load_bundled_profile(key: str) -> dict:
    path = os.path.join(PROFILES_DIR, f"{key}.yaml")
    if not os.path.isfile(path):
        raise ProfileNotFoundError(f"Profilo bundlato non trovato: {key!r}")
    with open(path) as f:
        return yaml.safe_load(f)


def create_upload_profile(session: Session, tracker: Tracker, profile_key: str | None) -> TrackerUploadProfile:
    """profile_key=None crea un profilo custom vuoto (docs/SPEC.md §9:
    "profilo custom da zero" è sempre un'opzione), altrimenti copia i
    valori dal file bundlato corrispondente."""
    if profile_key is None:
        profile = TrackerUploadProfile(tracker_id=tracker.id)
    else:
        data = _load_bundled_profile(profile_key)
        upload = data.get("upload", {})
        flags = upload.get("default_flags", {})
        profile = TrackerUploadProfile(
            tracker_id=tracker.id,
            category_id_map_json=json.dumps(upload.get("category_id", {})),
            type_id_map_json=json.dumps(upload.get("type_id", {})),
            resolution_id_map_json=json.dumps(upload.get("resolution_id", {})),
            naming_convention=upload.get("naming_convention"),
            description_template=upload.get("description_template"),
            default_anonymous=bool(flags.get("anonymous", False)),
            default_personal_release=bool(flags.get("personal_release", False)),
            source_profile_key=profile_key,
        )
    session.add(profile)
    session.commit()
    return profile
