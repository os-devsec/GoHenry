from typing import Any

import httpx
from fastapi import HTTPException

from .config import INTERNAL_SERVICE_TOKEN, USERS_SERVICE_URL


def create_user_profile(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        response = httpx.post(
            f"{USERS_SERVICE_URL}/internal/usuarios",
            json=payload,
            headers={"x-internal-token": INTERNAL_SERVICE_TOKEN},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo contactar users-service") from exc
    return _json_or_error(response)


def get_public_user(id_usuario: int | str, token: str) -> dict[str, Any]:
    try:
        response = httpx.get(
            f"{USERS_SERVICE_URL}/api/v1/usuarios/{id_usuario}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo contactar users-service") from exc
    return _json_or_error(response)


def _json_or_error(response: httpx.Response) -> dict[str, Any]:
    if response.is_success:
        return response.json()

    detail: Any = response.text
    try:
        detail = response.json().get("detail", detail)
    except ValueError:
        pass
    raise HTTPException(status_code=response.status_code, detail=detail)
