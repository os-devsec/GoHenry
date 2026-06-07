import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import jwt
import httpx
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../../database/integrador.db")
JWT_SECRET = os.getenv("JWT_SECRET", "integrador_secret")
JWT_ALGORITHM = "HS256"
STORE_LOGO_DIR = Path(os.getenv("STORE_LOGO_DIR", "uploads/stores")).resolve()
USERS_SERVICE_URL = os.getenv("USERS_SERVICE_URL", "http://users-service:8000")
INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "integrador_internal")


def sqlite_path() -> str:
    if DATABASE_URL.startswith("sqlite:///"):
        return DATABASE_URL.replace("sqlite:///", "", 1)
    return DATABASE_URL


DB_PATH = Path(sqlite_path()).resolve()

app = FastAPI(title="Restaurant Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
STORE_LOGO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/v1/tiendas/logos", StaticFiles(directory=STORE_LOGO_DIR), name="store-logos")


def db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    data = dict(row)
    for key, value in list(data.items()):
        if key in {"estado", "acepta_repartos"}:
            data[key] = bool(value)
    return data


def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.replace("Bearer ", "", 1)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Token invalido") from exc

    with db() as connection:
        row = connection.execute(
            "SELECT * FROM usuario WHERE id_usuario = ? AND estado = 1",
            (payload["sub"],),
        ).fetchone()
    user = row_to_dict(row)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


def is_platform_admin(user: dict[str, Any]) -> bool:
    return user.get("rol_sistema") == "admin_plataforma"


def require_platform_admin(user: dict[str, Any]) -> None:
    if not is_platform_admin(user):
        raise HTTPException(status_code=403, detail="Solo el admin de plataforma puede realizar esta accion")


def has_store_role(connection: sqlite3.Connection, id_tienda: int, user: dict[str, Any], roles: set[str]) -> bool:
    if is_platform_admin(user):
        return True
    row = connection.execute(
        """
        SELECT 1
        FROM tienda_usuario
        WHERE id_tienda = ? AND id_usuario = ? AND cargo IN ({}) AND estado = 1
        """.format(",".join("?" for _ in roles)),
        (id_tienda, user["id_usuario"], *roles),
    ).fetchone()
    return row is not None


def require_store_role(connection: sqlite3.Connection, id_tienda: int, user: dict[str, Any], roles: set[str]) -> None:
    if not has_store_role(connection, id_tienda, user, roles):
        raise HTTPException(status_code=403, detail="No tienes permisos para esta tienda")


class TiendaRequest(BaseModel):
    nombre: str
    sucursal: str | None = "Campus UIDE"
    ruta_logo: str | None = None
    nombre_lugar: str = "Campus UIDE"
    referencia: str | None = None
    horario_apertura: str = "08:00"
    horario_cierre: str = "18:00"


class PersonalRequest(BaseModel):
    cargo: str = "empleado"
    id_usuario: int | None = None
    nombre: str | None = None
    apellido: str | None = None
    correo: EmailStr | None = None
    telefono: str | None = None
    password: str | None = None


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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "restaurant-service"}


@app.get("/api/v1/tiendas")
def list_stores() -> list[dict[str, Any]]:
    with db() as connection:
        rows = connection.execute(
            """
            SELECT t.*, u.nombre_lugar, u.referencia
            FROM tienda t
            LEFT JOIN ubicacion u ON u.id_ubicacion = t.id_ubicacion
            WHERE t.estado = 1
            ORDER BY t.id_tienda
            """
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.post("/api/v1/tiendas")
def create_store(payload: TiendaRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_platform_admin(user)
    with db() as connection:
        location = connection.execute(
            """
            INSERT INTO ubicacion (nombre_lugar, referencia, tipo_ubicacion, estado)
            VALUES (?, ?, 'tienda', 1)
            """,
            (payload.nombre_lugar, payload.referencia),
        )
        cursor = connection.execute(
            """
            INSERT INTO tienda (id_ubicacion, nombre, sucursal, ruta_logo, horario_apertura, horario_cierre, estado)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (
                location.lastrowid,
                payload.nombre,
                payload.sucursal,
                payload.ruta_logo,
                payload.horario_apertura,
                payload.horario_cierre,
            ),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM tienda WHERE id_tienda = ?", (cursor.lastrowid,)).fetchone()
    return row_to_dict(row)


@app.patch("/api/v1/tiendas/{id_tienda}")
def update_store(
    id_tienda: int,
    payload: TiendaRequest,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    with db() as connection:
        require_store_role(connection, id_tienda, user, {"administrador"})
        store = connection.execute(
            "SELECT id_ubicacion FROM tienda WHERE id_tienda = ? AND estado = 1",
            (id_tienda,),
        ).fetchone()
        if not store:
            raise HTTPException(status_code=404, detail="Tienda no encontrada")

        connection.execute(
            """
            UPDATE tienda
            SET nombre = ?, sucursal = ?, horario_apertura = ?, horario_cierre = ?
            WHERE id_tienda = ?
            """,
            (
                payload.nombre.strip(),
                payload.sucursal,
                payload.horario_apertura,
                payload.horario_cierre,
                id_tienda,
            ),
        )
        if store["id_ubicacion"]:
            connection.execute(
                "UPDATE ubicacion SET nombre_lugar = ?, referencia = ? WHERE id_ubicacion = ?",
                (payload.nombre_lugar, payload.referencia, store["id_ubicacion"]),
            )
        else:
            location = connection.execute(
                """
                INSERT INTO ubicacion (nombre_lugar, referencia, tipo_ubicacion, estado)
                VALUES (?, ?, 'tienda', 1)
                """,
                (payload.nombre_lugar, payload.referencia),
            )
            connection.execute(
                "UPDATE tienda SET id_ubicacion = ? WHERE id_tienda = ?",
                (location.lastrowid, id_tienda),
            )
        connection.commit()
        row = connection.execute(
            """
            SELECT t.*, u.nombre_lugar, u.referencia
            FROM tienda t
            LEFT JOIN ubicacion u ON u.id_ubicacion = t.id_ubicacion
            WHERE t.id_tienda = ?
            """,
            (id_tienda,),
        ).fetchone()
    return row_to_dict(row)


@app.post("/api/v1/tiendas/{id_tienda}/logo")
async def upload_store_logo(
    id_tienda: int,
    logo: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if not logo.content_type or not logo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Archivo de logo invalido")

    with db() as connection:
        require_store_role(connection, id_tienda, user, {"administrador"})
        store = connection.execute("SELECT 1 FROM tienda WHERE id_tienda = ? AND estado = 1", (id_tienda,)).fetchone()
        if not store:
            raise HTTPException(status_code=404, detail="Tienda no encontrada")

        extension = Path(logo.filename or "").suffix.lower() or ".png"
        file_name = f"tienda-{id_tienda}-{int(datetime.now(timezone.utc).timestamp())}{extension}"
        destination = STORE_LOGO_DIR / file_name
        content = await logo.read()
        destination.write_bytes(content)

        relative = f"uploads/stores/{file_name}"
        connection.execute("UPDATE tienda SET ruta_logo = ? WHERE id_tienda = ?", (relative, id_tienda))
        connection.commit()
        row = connection.execute("SELECT * FROM tienda WHERE id_tienda = ?", (id_tienda,)).fetchone()
    return row_to_dict(row)


@app.get("/api/v1/tiendas/{id_tienda}/personal")
def list_store_staff(id_tienda: int, user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    with db() as connection:
        require_store_role(connection, id_tienda, user, {"administrador", "empleado"})
        rows = connection.execute(
            """
            SELECT tu.*, u.nombre, u.apellido, u.correo, u.telefono, u.rol_sistema
            FROM tienda_usuario tu
            JOIN usuario u ON u.id_usuario = tu.id_usuario
            WHERE tu.id_tienda = ? AND tu.estado = 1
            """,
            (id_tienda,),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.post("/api/v1/tiendas/{id_tienda}/personal")
def add_store_staff(
    id_tienda: int,
    payload: PersonalRequest,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if payload.cargo not in {"administrador", "empleado"}:
        raise HTTPException(status_code=400, detail="Cargo invalido")
    with db() as connection:
        require_store_role(connection, id_tienda, user, {"administrador"})
        store = connection.execute("SELECT 1 FROM tienda WHERE id_tienda = ? AND estado = 1", (id_tienda,)).fetchone()
        if not store:
            raise HTTPException(status_code=404, detail="Tienda no encontrada")

        staff_user = resolve_staff_user(payload)
        id_usuario = staff_user["id_usuario"]

        existing_staff = connection.execute(
            "SELECT id_tienda_usuario FROM tienda_usuario WHERE id_tienda = ? AND id_usuario = ?",
            (id_tienda, id_usuario),
        ).fetchone()
        if existing_staff:
            connection.execute(
                "UPDATE tienda_usuario SET cargo = ?, estado = 1 WHERE id_tienda_usuario = ?",
                (payload.cargo, existing_staff["id_tienda_usuario"]),
            )
            id_tienda_usuario = existing_staff["id_tienda_usuario"]
        else:
            cursor = connection.execute(
                """
                INSERT INTO tienda_usuario (id_tienda, id_usuario, cargo, estado)
                VALUES (?, ?, ?, 1)
                """,
                (id_tienda, id_usuario, payload.cargo),
            )
            id_tienda_usuario = cursor.lastrowid

        connection.commit()
        row = connection.execute(
            """
            SELECT tu.*, u.nombre, u.apellido, u.correo, u.telefono, u.rol_sistema
            FROM tienda_usuario tu
            JOIN usuario u ON u.id_usuario = tu.id_usuario
            WHERE tu.id_tienda_usuario = ?
            """,
            (id_tienda_usuario,),
        ).fetchone()
    return row_to_dict(row)


@app.delete("/api/v1/tiendas/{id_tienda}/personal/{id_tienda_usuario}")
def remove_store_staff(
    id_tienda: int,
    id_tienda_usuario: int,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, bool]:
    with db() as connection:
        require_store_role(connection, id_tienda, user, {"administrador"})
        connection.execute(
            "UPDATE tienda_usuario SET estado = 0 WHERE id_tienda = ? AND id_tienda_usuario = ?",
            (id_tienda, id_tienda_usuario),
        )
        connection.commit()
    return {"ok": True}
