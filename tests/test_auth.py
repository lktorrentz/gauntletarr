from app import auth


def test_hash_and_verify_password_roundtrip():
    hashed = auth.hash_password("correct horse battery staple")
    assert auth.verify_password("correct horse battery staple", hashed)
    assert not auth.verify_password("wrong password", hashed)


def test_verify_password_rejects_malformed_hash():
    assert not auth.verify_password("anything", "not-a-real-hash")


def test_create_and_decode_access_token_roundtrip(monkeypatch):
    monkeypatch.setenv("APP_SECRET_KEY", "test-secret")
    token = auth.create_access_token("admin")
    assert auth.decode_access_token(token) == "admin"


def test_decode_access_token_rejects_garbage(monkeypatch):
    monkeypatch.setenv("APP_SECRET_KEY", "test-secret")
    assert auth.decode_access_token("not-a-jwt") is None


def test_api_untouched_when_auth_never_configured(client):
    """Nessuna istanza esistente deve rompersi solo perché questa fase è
    stata aggiunta: senza auth_username/auth_password_hash impostati,
    ogni endpoint protetto resta raggiungibile senza alcun token."""
    response = client.get("/api/disks")
    assert response.status_code == 200


def test_auth_status_reports_not_configured_by_default(client):
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    assert response.json() == {"configured": False}


def test_setup_creates_account_and_returns_token(client):
    response = client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"})

    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "admin"
    assert body["access_token"]


def test_setup_rejects_short_password(client):
    response = client.post("/api/auth/setup", json={"username": "admin", "password": "short"})
    assert response.status_code == 400


def test_setup_twice_is_rejected(client):
    client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"})

    response = client.post("/api/auth/setup", json={"username": "someoneelse", "password": "supersecret1"})

    assert response.status_code == 409


def test_protected_endpoint_requires_token_once_configured(client):
    client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"})

    response = client.get("/api/disks")

    assert response.status_code == 401


def test_protected_endpoint_accepts_valid_token(client):
    setup = client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"}).json()

    response = client.get("/api/disks", headers={"Authorization": f"Bearer {setup['access_token']}"})

    assert response.status_code == 200


def test_login_with_correct_credentials_returns_token(client):
    client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"})

    response = client.post("/api/auth/login", json={"username": "admin", "password": "supersecret1"})

    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_login_with_wrong_password_rejected(client):
    client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"})

    response = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})

    assert response.status_code == 401


def test_login_before_setup_rejected(client):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "supersecret1"})
    assert response.status_code == 401


def test_me_returns_username_for_valid_token(client):
    setup = client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"}).json()

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {setup['access_token']}"})

    assert response.status_code == 200
    assert response.json() == {"username": "admin"}


def test_me_rejects_missing_token(client):
    client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"})

    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_change_password_requires_current_password(client):
    setup = client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"}).json()
    headers = {"Authorization": f"Bearer {setup['access_token']}"}

    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong", "new_password": "newpassword1"},
        headers=headers,
    )

    assert response.status_code == 401


def test_change_password_success_allows_login_with_new_password(client):
    setup = client.post("/api/auth/setup", json={"username": "admin", "password": "supersecret1"}).json()
    headers = {"Authorization": f"Bearer {setup['access_token']}"}

    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "supersecret1", "new_password": "newpassword1"},
        headers=headers,
    )
    assert response.status_code == 204

    old_login = client.post("/api/auth/login", json={"username": "admin", "password": "supersecret1"})
    assert old_login.status_code == 401

    new_login = client.post("/api/auth/login", json={"username": "admin", "password": "newpassword1"})
    assert new_login.status_code == 200
