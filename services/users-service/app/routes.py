from typing import Any

from fastapi import APIRouter, Depends
from pydantic import EmailStr
from sqlmodel import Session

from .database import get_session
from .schemas import AccountUpdateRequest, InternalUserRequest, PlatformAdminRequest, RepartosRequest
from .security import current_user, require_internal_service
from . import services


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "users-service"}


@router.get("/api/v1/usuarios")
def list_users(
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> list[dict[str, Any]]:
    return services.list_users(session, user)


@router.post("/internal/usuarios")
def create_or_get_internal_user(
    payload: InternalUserRequest,
    _internal: None = Depends(require_internal_service),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.create_or_get_internal_user(session, payload)


@router.post("/api/v1/admin-plataforma")
def create_platform_admin(
    payload: PlatformAdminRequest,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.create_platform_admin(session, payload, user)


@router.get("/api/v1/usuarios/repartidores")
def list_delivery_users(session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    return services.list_delivery_users(session)


@router.get("/api/v1/usuarios/buscar/correo/{correo}")
def get_user_by_email(
    correo: EmailStr,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.get_user_by_email(session, str(correo), user)


@router.get("/api/v1/usuarios/{id_usuario}")
def get_user(
    id_usuario: int,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.get_user(session, id_usuario, user)


@router.patch("/api/v1/usuarios/{id_usuario}/repartos")
def update_delivery_mode(
    id_usuario: int,
    payload: RepartosRequest,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.update_delivery_mode(session, id_usuario, payload, user)


@router.patch("/api/v1/usuarios/{id_usuario}")
def update_account(
    id_usuario: int,
    payload: AccountUpdateRequest,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.update_account(session, id_usuario, payload, user)
