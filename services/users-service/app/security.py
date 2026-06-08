import hashlib
import secrets
from typing import Any

import jwt
from fastapi import Header, HTTPException
from sqlmodel import Session

from .config import INTERNAL_SERVICE_TOKEN, JWT_ALGORITHM, JWT_SECRET
from .database import engine
from . import repositories


def hash_password(password: str) -> str:
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


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
        return user.model_dump()


def is_platform_admin(user: dict[str, Any]) -> bool:
    return user.get("rol_usuario") == "admin_plataforma"


def require_platform_admin(user: dict[str, Any]) -> None:
    if not is_platform_admin(user):
        raise HTTPException(status_code=403, detail="Solo el admin de plataforma puede realizar esta accion")


def require_internal_service(x_internal_token: str | None = Header(default=None)) -> None:
    if not x_internal_token or not secrets.compare_digest(x_internal_token, INTERNAL_SERVICE_TOKEN):
        raise HTTPException(status_code=403, detail="Token interno invalido")
