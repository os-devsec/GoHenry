from typing import Any

import secrets
from fastapi import Header, HTTPException
from sqlmodel import Session

from . import repositories, user_client
from .config import INTERNAL_SERVICE_TOKEN


def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    return user_client.current_user(authorization)


def is_platform_admin(user: dict[str, Any]) -> bool:
    return user.get("rol_usuario") == "admin_plataforma"


def require_platform_admin(user: dict[str, Any]) -> None:
    if not is_platform_admin(user):
        raise HTTPException(status_code=403, detail="Solo el admin de plataforma puede realizar esta accion")


def has_store_role(session: Session, id_tienda: int, user: dict[str, Any], roles: set[str]) -> bool:
    if is_platform_admin(user):
        return True
    return repositories.has_store_role(session, id_tienda, user["id_usuario"], roles)


def require_store_role(session: Session, id_tienda: int, user: dict[str, Any], roles: set[str]) -> None:
    if not has_store_role(session, id_tienda, user, roles):
        raise HTTPException(status_code=403, detail="No tienes permisos para esta tienda")


def require_internal_service(x_internal_token: str | None = Header(default=None)) -> None:
    if not x_internal_token or not secrets.compare_digest(x_internal_token, INTERNAL_SERVICE_TOKEN):
        raise HTTPException(status_code=403, detail="Token interno invalido")
