from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlmodel import Session

from .config import STORE_LOGO_DIR
from . import repositories
from .schemas import PersonalRequest, TiendaRequest
from .security import require_platform_admin, require_store_role
from .staff_client import resolve_staff_user


def list_stores(session: Session) -> list[dict[str, Any]]:
    return repositories.list_stores(session)


def create_store(session: Session, payload: TiendaRequest, user: dict[str, Any]) -> dict[str, Any]:
    require_platform_admin(user)
    return repositories.create_store(session, payload)


def update_store(
    session: Session,
    id_tienda: int,
    payload: TiendaRequest,
    user: dict[str, Any],
) -> dict[str, Any]:
    require_store_role(session, id_tienda, user, {"administrador"})
    store = repositories.get_active_store(session, id_tienda)
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return repositories.update_store(session, store, payload)


async def upload_store_logo(
    session: Session,
    id_tienda: int,
    logo: UploadFile,
    user: dict[str, Any],
    file_name: str,
) -> dict[str, Any]:
    if not logo.content_type or not logo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Archivo de logo invalido")
    require_store_role(session, id_tienda, user, {"administrador"})
    store = repositories.get_active_store(session, id_tienda)
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    destination = STORE_LOGO_DIR / file_name
    content = await logo.read()
    destination.write_bytes(content)
    return repositories.update_logo(session, store, f"uploads/stores/{Path(file_name).name}")


def list_store_staff(session: Session, id_tienda: int, user: dict[str, Any]) -> list[dict[str, Any]]:
    require_store_role(session, id_tienda, user, {"administrador", "empleado"})
    return repositories.list_staff(session, id_tienda)


def add_store_staff(session: Session, id_tienda: int, payload: PersonalRequest, user: dict[str, Any]) -> dict[str, Any]:
    if payload.cargo not in {"administrador", "empleado"}:
        raise HTTPException(status_code=400, detail="Cargo invalido")
    require_store_role(session, id_tienda, user, {"administrador"})
    if not repositories.get_active_store(session, id_tienda):
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    staff_user = resolve_staff_user(payload)
    return repositories.upsert_staff(session, id_tienda, staff_user["id_usuario"], payload.cargo)


def remove_store_staff(session: Session, id_tienda: int, id_tienda_usuario: int, user: dict[str, Any]) -> dict[str, bool]:
    require_store_role(session, id_tienda, user, {"administrador"})
    repositories.remove_staff(session, id_tienda, id_tienda_usuario)
    return {"ok": True}
