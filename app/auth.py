"""Login JWT (Fase 9) — protegge le API e la WebUI dietro un unico account
amministratore, mai basic auth. Le credenziali vivono in app_settings
(auth_username/auth_password_hash), coerente con "tutto tranne i mount
point vive nel DB, editabile da UI" (CLAUDE.md) — finché non sono
configurate, l'app resta aperta esattamente come oggi: nessuna rottura per
chi aggiorna un'istanza già in uso senza aver mai impostato un login.

Il segreto di firma JWT riusa APP_SECRET_KEY (già l'unico segreto che
questo progetto richiede via env, usato per cifrare le credenziali in
app/crypto.py) invece di introdurne un secondo da gestire."""

import hashlib
import hmac
import os
import secrets
import time

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import settings_repo
from app.crypto import SecretKeyMissingError
from app.deps import get_session

_PBKDF2_ITERATIONS = 260_000
_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 giorni — self-hosted, nessun refresh flow per ora


def _jwt_secret() -> str:
    key = os.environ.get("APP_SECRET_KEY")
    if not key:
        raise SecretKeyMissingError(
            "APP_SECRET_KEY non impostata: necessaria anche per firmare i token di login."
        )
    return key


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS).hex()
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algo, iterations, salt, digest = stored_hash.split("$")
        if algo != "pbkdf2_sha256":
            return False
        computed = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations)).hex()
        return hmac.compare_digest(computed, digest)
    except (ValueError, AttributeError):
        return False


def is_auth_configured(session: Session) -> bool:
    return bool(settings_repo.get_setting(session, "auth_username")) and bool(
        settings_repo.get_setting(session, "auth_password_hash")
    )


def create_access_token(username: str) -> str:
    payload = {"sub": username, "exp": int(time.time()) + _TOKEN_TTL_SECONDS}
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


def authenticated_username(request: Request, session: Session) -> str | None:
    """None se l'header manca, il token è invalido/scaduto, o non
    corrisponde all'unico account configurato — mai un'eccezione qui,
    il chiamante decide cosa fare (require_auth la solleva, /api/auth/me no)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    username = decode_access_token(auth_header.removeprefix("Bearer "))
    stored_username = settings_repo.get_setting(session, "auth_username")
    if username is None or stored_username is None or username != stored_username:
        return None
    return username


def require_auth(request: Request, session: Session = Depends(get_session)) -> str | None:
    """Dependency applicata a ogni router protetto (app/main.py). Ritorna
    None senza sollevare finché nessun login è mai stato configurato —
    è l'unico modo per restare compatibili con un'istanza esistente che
    non ha mai impostato un account, e per far funzionare il primissimo
    /api/auth/setup (che deve restare raggiungibile senza token)."""
    if not is_auth_configured(session):
        return None
    username = authenticated_username(request, session)
    if username is None:
        raise HTTPException(status_code=401, detail="Autenticazione richiesta")
    return username
