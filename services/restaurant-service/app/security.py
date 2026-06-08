from typing import Any

import jwt
from fastapi import Header, HTTPException
from sqlmodel import Session

from .config import JWT_ALGORITHM, JWT_SECRET
from .database import engine
from . import repositories


def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.replace("Bearer ", "", 1)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Token invalido") from exc

    with Session(engine) as session:
        user = repositories.get_active_user_by_id(session, payload["sub"])
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user.model_dump()


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
