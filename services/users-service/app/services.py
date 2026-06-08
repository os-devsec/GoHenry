from typing import Any

from fastapi import HTTPException
from sqlmodel import Session

from . import repositories
from .schemas import AccountUpdateRequest, InternalUserRequest, PlatformAdminRequest, RepartosRequest
from .security import hash_password, is_platform_admin, require_platform_admin


def list_users(session: Session, current_user: dict[str, Any]) -> list[dict[str, Any]]:
    require_platform_admin(current_user)
    return repositories.list_users(session)


def create_or_get_internal_user(session: Session, payload: InternalUserRequest) -> dict[str, Any]:
    existing = None
    if payload.id_usuario:
        existing = repositories.get_user_by_id(session, payload.id_usuario)
        if not existing:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
    elif payload.correo:
        existing = repositories.get_user_by_email(session, str(payload.correo))

    if existing:
        return repositories.public_user(session, existing)

    require_fields(
        "crear usuario",
        {
            "nombre": payload.nombre,
            "apellido": payload.apellido,
            "correo": payload.correo,
            "telefono": payload.telefono,
            "password": payload.password,
        },
    )
    created = repositories.create_client(
        session,
        nombre=payload.nombre or "",
        apellido=payload.apellido or "",
        correo=str(payload.correo),
        telefono=payload.telefono,
        password_hash=hash_password(payload.password or ""),
    )
    return repositories.public_user(session, created)


def create_platform_admin(
    session: Session,
    payload: PlatformAdminRequest,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    require_platform_admin(current_user)
    existing = repositories.get_user_by_email(session, str(payload.correo))
    if existing:
        promoted = repositories.promote_to_platform_admin(session, existing)
        return repositories.public_user(session, promoted)

    require_fields(
        "crear admin",
        {
            "nombre": payload.nombre,
            "apellido": payload.apellido,
            "telefono": payload.telefono,
            "password": payload.password,
        },
    )
    created = repositories.create_platform_admin(
        session,
        nombre=payload.nombre or "",
        apellido=payload.apellido or "",
        correo=str(payload.correo),
        telefono=payload.telefono,
        password_hash=hash_password(payload.password or ""),
    )
    return repositories.public_user(session, created)


def list_delivery_users(session: Session) -> list[dict[str, Any]]:
    return repositories.list_delivery_users(session)


def get_user_by_email(session: Session, correo: str, current_user: dict[str, Any]) -> dict[str, Any]:
    require_platform_admin(current_user)
    found = repositories.get_user_by_email(session, correo)
    if not found:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return repositories.public_fields(found)


def get_user(session: Session, id_usuario: int, current_user: dict[str, Any]) -> dict[str, Any]:
    if id_usuario != current_user["id_usuario"] and not is_platform_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo puedes consultar tu propio usuario")
    found = repositories.get_user_by_id(session, id_usuario, active_only=True)
    if not found:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return repositories.public_user(session, found)


def update_delivery_mode(
    session: Session,
    id_usuario: int,
    payload: RepartosRequest,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    if id_usuario != current_user["id_usuario"] and not is_platform_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo puedes cambiar tu propio modo delivery")
    found = repositories.get_user_by_id(session, id_usuario)
    if not found:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    updated = repositories.update_delivery_mode(session, found, payload.acepta_repartos)
    return repositories.public_user(session, updated)


def update_account(
    session: Session,
    id_usuario: int,
    payload: AccountUpdateRequest,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    if id_usuario != current_user["id_usuario"]:
        raise HTTPException(status_code=403, detail="Solo el dueno puede editar esta cuenta")
    if not payload.nombre.strip() or not payload.apellido.strip() or not payload.telefono.strip():
        raise HTTPException(status_code=400, detail="Nombre, apellido y telefono son obligatorios")

    password_hash = None
    if payload.password:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="La contrasena debe tener al menos 6 caracteres")
        password_hash = hash_password(payload.password)

    found = repositories.get_user_by_id(session, id_usuario)
    if not found:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    updated = repositories.update_account(
        session,
        found,
        nombre=payload.nombre.strip(),
        apellido=payload.apellido.strip(),
        telefono=payload.telefono.strip(),
        password_hash=password_hash,
    )
    return repositories.public_user(session, updated)


def require_fields(action: str, values: dict[str, Any]) -> None:
    missing = [field for field, value in values.items() if not value]
    if missing:
        raise HTTPException(status_code=400, detail=f"Faltan datos para {action}: {', '.join(missing)}")
