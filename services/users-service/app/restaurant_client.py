from typing import Any

import httpx
from fastapi import HTTPException

from .config import INTERNAL_SERVICE_TOKEN, RESTAURANT_SERVICE_URL


def list_user_store_staff(id_usuario: int) -> list[dict[str, Any]]:
    try:
        response = httpx.get(
            f"{RESTAURANT_SERVICE_URL}/internal/usuarios/{id_usuario}/tiendas",
            headers={"X-Internal-Token": INTERNAL_SERVICE_TOKEN},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo contactar restaurant-service") from exc

    if response.is_success:
        return response.json()

    detail: Any = response.text
    try:
        detail = response.json().get("detail", detail)
    except ValueError:
        pass
    raise HTTPException(status_code=response.status_code, detail=detail)
