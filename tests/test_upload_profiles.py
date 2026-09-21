import json

import pytest

from app import upload_profiles
from app.models import Tracker


def _tracker(db_session):
    t = Tracker(label="t", adapter_type="unit3d", base_url="https://t.example", api_token="x")
    db_session.add(t)
    db_session.commit()
    return t


def test_list_bundled_profiles_includes_itt():
    profiles = upload_profiles.list_bundled_profiles()

    keys = {p["key"] for p in profiles}
    assert "itt" in keys


def test_create_upload_profile_from_bundled_key(db_session):
    tracker = _tracker(db_session)

    profile = upload_profiles.create_upload_profile(db_session, tracker, "itt")

    assert profile.tracker_id == tracker.id
    assert profile.source_profile_key == "itt"
    category_map = json.loads(profile.category_id_map_json)
    assert category_map["movie"] == 1
    assert category_map["tv"] == 2
    type_map = json.loads(profile.type_id_map_json)
    assert type_map["REMUX"] == 2
    assert profile.default_anonymous is False


def test_create_upload_profile_custom_is_empty(db_session):
    tracker = _tracker(db_session)

    profile = upload_profiles.create_upload_profile(db_session, tracker, None)

    assert profile.source_profile_key is None
    assert profile.category_id_map_json is None
    assert profile.description_template is None


def test_create_upload_profile_unknown_key_raises(db_session):
    tracker = _tracker(db_session)

    with pytest.raises(upload_profiles.ProfileNotFoundError):
        upload_profiles.create_upload_profile(db_session, tracker, "does-not-exist")
