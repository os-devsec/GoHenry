from typing import Any

import httpx
from fastapi import HTTPException

from .config import AUTH_SERVICE_URL, INTERNAL_SERVICE_TOKEN, USERS_SERVICE_URL
from .schemas import PersonalRequest


def current_user(authorization: str) -> dict[str, Any]:
    try:
        response = httpx.get(
            f"{AUTH_SERVICE_URL}/api/v1/auth/me",
            headers={"Authorization": authorization},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo contactar auth-service") from exc
    return _json_or_error(response)


def resolve_staff_user(payload: PersonalRequest) -> dict[str, Any]:
    body = {
        "id_usuario": payload.id_usuario,
        "nombre": payload.nombre,
        "apellido": payload.apellido,
        "correo": payload.correo,
        "telefono": payload.telefono,
        "password": payload.password,
    }
    try:
        response = httpx.post(
            f"{USERS_SERVICE_URL}/internal/usuarios",
            json=body,
            headers={"X-Internal-Token": INTERNAL_SERVICE_TOKEN},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo contactar users-service") from exc
    return _json_or_error(response)


def lookup_users(ids_usuario: list[int]) -> dict[int, dict[str, Any]]:
    if not ids_usuario:
        return {}
    try:
        response = httpx.post(
            f"{USERS_SERVICE_URL}/internal/usuarios/lookup",
            json={"ids_usuario": ids_usuario},
            headers={"X-Internal-Token": INTERNAL_SERVICE_TOKEN},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo contactar users-service") from exc

    users = _json_or_error(response)
    return {int(user["id_usuario"]): user for user in users}


def _json_or_error(response: httpx.Response) -> Any:
    if response.is_success:
        return response.json()

    detail: Any = response.text
    try:
        detail = response.json().get("detail", detail)
    except ValueError:
        pass
    raise HTTPException(status_code=response.status_code, detail=detail)
