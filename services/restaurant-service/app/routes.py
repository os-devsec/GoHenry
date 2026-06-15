from typing import Any

from fastapi import APIRouter, Depends
from sqlmodel import Session

from .database import get_session
from .schemas import PersonalRequest, StoreAvailabilityRequest, StoreStaffRoleRequest, TiendaRequest
from .security import current_user, require_internal_service
from . import services


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "restaurant-service"}


@router.get("/api/v1/tiendas")
def list_stores(session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    return services.list_stores(session)


@router.post("/api/v1/tiendas")
def create_store(
    payload: TiendaRequest,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.create_store(session, payload, user)


@router.patch("/api/v1/tiendas/{id_tienda}")
def update_store(
    id_tienda: int,
    payload: TiendaRequest,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.update_store(session, id_tienda, payload, user)


@router.patch("/api/v1/tiendas/{id_tienda}/disponibilidad")
def update_store_availability(
    id_tienda: int,
    payload: StoreAvailabilityRequest,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.update_store_availability(session, id_tienda, payload.estado, user)


@router.delete("/api/v1/tiendas/{id_tienda}")
def delete_store(
    id_tienda: int,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    return services.delete_store(session, id_tienda, user)


@router.get("/api/v1/tiendas/{id_tienda}/personal")
def list_store_staff(
    id_tienda: int,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> list[dict[str, Any]]:
    return services.list_store_staff(session, id_tienda, user)


@router.post("/api/v1/tiendas/{id_tienda}/personal")
def add_store_staff(
    id_tienda: int,
    payload: PersonalRequest,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return services.add_store_staff(session, id_tienda, payload, user)


@router.post("/internal/tiendas/{id_tienda}/personal/permisos")
def has_store_staff_role(
    id_tienda: int,
    payload: StoreStaffRoleRequest,
    _internal: None = Depends(require_internal_service),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    return services.has_store_staff_role(session, id_tienda, payload.id_usuario, payload.roles)


@router.get("/internal/usuarios/{id_usuario}/tiendas")
def list_user_store_staff(
    id_usuario: int,
    _internal: None = Depends(require_internal_service),
    session: Session = Depends(get_session),
) -> list[dict[str, Any]]:
    return services.list_user_store_staff(session, id_usuario)


@router.delete("/api/v1/tiendas/{id_tienda}/personal/{id_tienda_usuario}")
def remove_store_staff(
    id_tienda: int,
    id_tienda_usuario: int,
    user: dict[str, Any] = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    return services.remove_store_staff(session, id_tienda, id_tienda_usuario, user)
