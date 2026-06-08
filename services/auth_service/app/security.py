import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Header, HTTPException
from sqlmodel import Session

from .config import JWT_ALGORITHM, JWT_SECRET
from .database import engine
from . import repositories


def hash_password(password: str) -> str:
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("sha256:"):
        return secrets.compare_digest(hash_password(password), stored)
    return False


def create_token(user: dict[str, Any]) -> str:
    payload = {
        "sub": str(user["id_usuario"]),
        "correo": user["correo"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.replace("Bearer ", "", 1)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Token invalido") from exc

    with Session(engine) as session:
        user = repositories.get_user_by_id(session, payload["sub"], active_only=True)
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return repositories.public_user(session, user)
