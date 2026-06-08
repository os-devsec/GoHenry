from typing import Any

import httpx
from fastapi import HTTPException

from .config import INTERNAL_SERVICE_TOKEN, USERS_SERVICE_URL
from .schemas import PersonalRequest


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
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="No se pudo conectar con users-service") from exc
    if response.status_code >= 400:
        detail = response.json().get("detail", "No se pudo resolver el usuario")
        raise HTTPException(status_code=response.status_code, detail=detail)
    return response.json()
