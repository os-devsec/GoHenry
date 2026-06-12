from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlmodel import Session

from .config import STORE_LOGO_DIR
from . import repositories, user_client
from .schemas import PersonalRequest, TiendaRequest
from .security import require_platform_admin, require_store_role


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
    staff_memberships = repositories.list_store_staff(session, id_tienda)
    users_by_id = user_client.lookup_users([staff.id_usuario for staff in staff_memberships])
    return [store_staff_row(staff.model_dump(), users_by_id.get(staff.id_usuario, {})) for staff in staff_memberships]


def add_store_staff(session: Session, id_tienda: int, payload: PersonalRequest, user: dict[str, Any]) -> dict[str, Any]:
    if payload.cargo not in {"administrador", "empleado"}:
        raise HTTPException(status_code=400, detail="Cargo invalido")
    require_store_role(session, id_tienda, user, {"administrador"})
    if not repositories.get_active_store(session, id_tienda):
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    staff_user = user_client.resolve_staff_user(payload)
    staff = repositories.upsert_store_staff(session, id_tienda, staff_user["id_usuario"], payload.cargo)
    return store_staff_row(staff.model_dump(), staff_user)


def remove_store_staff(session: Session, id_tienda: int, id_tienda_usuario: int, user: dict[str, Any]) -> dict[str, bool]:
    require_store_role(session, id_tienda, user, {"administrador"})
    repositories.remove_store_staff(session, id_tienda, id_tienda_usuario)
    return {"ok": True}


def has_store_staff_role(session: Session, id_tienda: int, id_usuario: int, roles: list[str]) -> dict[str, bool]:
    allowed_roles = {role for role in roles if role in {"administrador", "empleado"}}
    if not allowed_roles:
        return {"allowed": False}
    return {"allowed": repositories.has_store_role(session, id_tienda, id_usuario, allowed_roles)}


def list_user_store_staff(session: Session, id_usuario: int) -> list[dict[str, Any]]:
    return repositories.list_user_store_staff(session, id_usuario)


def store_staff_row(staff: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    return {
        **staff,
        "nombre": user.get("nombre"),
        "apellido": user.get("apellido"),
        "correo": user.get("correo"),
        "telefono": user.get("telefono"),
        "rol_usuario": user.get("rol_usuario"),
    }
