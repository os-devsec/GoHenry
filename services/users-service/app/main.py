import hashlib
import os
import secrets
import sqlite3
from pathlib import Path
from typing import Any

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../../database/integrador.db")
JWT_SECRET = os.getenv("JWT_SECRET", "integrador_secret")
JWT_ALGORITHM = "HS256"
INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "integrador_internal")


def sqlite_path() -> str:
    if DATABASE_URL.startswith("sqlite:///"):
        return DATABASE_URL.replace("sqlite:///", "", 1)
    return DATABASE_URL


DB_PATH = Path(sqlite_path()).resolve()

app = FastAPI(title="Users Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def hash_password(password: str) -> str:
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def store_memberships(connection: sqlite3.Connection, id_usuario: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT tu.id_tienda_usuario, tu.id_tienda, tu.id_usuario, tu.cargo, tu.estado,
               t.nombre AS tienda_nombre, t.sucursal
        FROM tienda_usuario tu
        JOIN tienda t ON t.id_tienda = tu.id_tienda
        WHERE tu.id_usuario = ? AND tu.estado = 1 AND t.estado = 1
        ORDER BY t.nombre
        """,
        (id_usuario,),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def public_user(connection: sqlite3.Connection, user: dict[str, Any]) -> dict[str, Any]:
    data = dict(user)
    data.pop("password_hash", None)
    data.setdefault("rol_sistema", "cliente")
    data["tiendas"] = store_memberships(connection, data["id_usuario"])
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


class RepartosRequest(BaseModel):
    acepta_repartos: bool


class AccountUpdateRequest(BaseModel):
    nombre: str
    apellido: str
    telefono: str
    direccion: str | None = None
    password: str | None = None


class PlatformAdminRequest(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    correo: EmailStr
    telefono: str | None = None
    password: str | None = None


class InternalUserRequest(BaseModel):
    id_usuario: int | None = None
    nombre: str | None = None
    apellido: str | None = None
    correo: EmailStr | None = None
    telefono: str | None = None
    password: str | None = None


def require_internal_service(x_internal_token: str | None = Header(default=None)) -> None:
    if not x_internal_token or not secrets.compare_digest(x_internal_token, INTERNAL_SERVICE_TOKEN):
        raise HTTPException(status_code=403, detail="Token interno invalido")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "users-service"}


@app.get("/api/v1/usuarios")
def list_users(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    require_platform_admin(user)
    with db() as connection:
        rows = connection.execute(
            "SELECT id_usuario, nombre, apellido, correo, telefono, rol_sistema, acepta_repartos, estado FROM usuario"
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.post("/internal/usuarios")
def create_or_get_internal_user(
    payload: InternalUserRequest,
    _internal: None = Depends(require_internal_service),
) -> dict[str, Any]:
    with db() as connection:
        existing = None
        if payload.id_usuario:
            existing = connection.execute("SELECT * FROM usuario WHERE id_usuario = ?", (payload.id_usuario,)).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
        elif payload.correo:
            existing = connection.execute("SELECT * FROM usuario WHERE correo = ?", (payload.correo,)).fetchone()

        if existing:
            return public_user(connection, row_to_dict(existing))

        missing = [
            field
            for field, value in {
                "nombre": payload.nombre,
                "apellido": payload.apellido,
                "correo": payload.correo,
                "telefono": payload.telefono,
                "password": payload.password,
            }.items()
            if not value
        ]
        if missing:
            raise HTTPException(status_code=400, detail=f"Faltan datos para crear usuario: {', '.join(missing)}")

        cursor = connection.execute(
            """
            INSERT INTO usuario (nombre, apellido, correo, telefono, password_hash, rol_sistema, acepta_repartos, estado)
            VALUES (?, ?, ?, ?, ?, 'cliente', 0, 1)
            """,
            (
                payload.nombre,
                payload.apellido,
                payload.correo,
                payload.telefono,
                hash_password(payload.password),
            ),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM usuario WHERE id_usuario = ?", (cursor.lastrowid,)).fetchone()
        return public_user(connection, row_to_dict(row))


@app.post("/api/v1/admin-plataforma")
def create_platform_admin(payload: PlatformAdminRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_platform_admin(user)
    with db() as connection:
        existing = connection.execute("SELECT * FROM usuario WHERE correo = ?", (payload.correo,)).fetchone()
        if existing:
            connection.execute(
                "UPDATE usuario SET rol_sistema = 'admin_plataforma', estado = 1 WHERE correo = ?",
                (payload.correo,),
            )
            id_usuario = existing["id_usuario"]
        else:
            missing = [
                field
                for field, value in {
                    "nombre": payload.nombre,
                    "apellido": payload.apellido,
                    "telefono": payload.telefono,
                    "password": payload.password,
                }.items()
                if not value
            ]
            if missing:
                raise HTTPException(status_code=400, detail=f"Faltan datos para crear admin: {', '.join(missing)}")
            cursor = connection.execute(
                """
                INSERT INTO usuario
                (nombre, apellido, correo, telefono, password_hash, rol_sistema, acepta_repartos, estado)
                VALUES (?, ?, ?, ?, ?, 'admin_plataforma', 0, 1)
                """,
                (
                    payload.nombre,
                    payload.apellido,
                    payload.correo,
                    payload.telefono,
                    hash_password(payload.password),
                ),
            )
            id_usuario = cursor.lastrowid
        connection.commit()
        row = connection.execute("SELECT * FROM usuario WHERE id_usuario = ?", (id_usuario,)).fetchone()
        return public_user(connection, row_to_dict(row))


@app.get("/api/v1/usuarios/repartidores")
def list_delivery_users() -> list[dict[str, Any]]:
    with db() as connection:
        rows = connection.execute(
            """
            SELECT id_usuario, nombre, apellido, correo, telefono, acepta_repartos, estado
            FROM usuario
            WHERE acepta_repartos = 1 AND estado = 1
            ORDER BY id_usuario
            """
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.get("/api/v1/usuarios/buscar/correo/{correo}")
def get_user_by_email(correo: EmailStr, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_platform_admin(user)
    with db() as connection:
        row = connection.execute(
            "SELECT id_usuario, nombre, apellido, correo, telefono, rol_sistema, acepta_repartos, estado FROM usuario WHERE correo = ?",
            (correo,),
        ).fetchone()
    found = row_to_dict(row)
    if not found:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return found


@app.get("/api/v1/usuarios/{id_usuario}")
def get_user(id_usuario: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if id_usuario != user["id_usuario"] and not is_platform_admin(user):
        raise HTTPException(status_code=403, detail="Solo puedes consultar tu propio usuario")
    with db() as connection:
        row = connection.execute(
            "SELECT * FROM usuario WHERE id_usuario = ? AND estado = 1",
            (id_usuario,),
        ).fetchone()
        found = row_to_dict(row)
        if not found:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return public_user(connection, found)


@app.patch("/api/v1/usuarios/{id_usuario}/repartos")
def update_delivery_mode(
    id_usuario: int,
    payload: RepartosRequest,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if id_usuario != user["id_usuario"] and not is_platform_admin(user):
        raise HTTPException(status_code=403, detail="Solo puedes cambiar tu propio modo delivery")
    with db() as connection:
        connection.execute(
            "UPDATE usuario SET acepta_repartos = ? WHERE id_usuario = ?",
            (int(payload.acepta_repartos), id_usuario),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM usuario WHERE id_usuario = ?", (id_usuario,)).fetchone()
        return public_user(connection, row_to_dict(row))


@app.patch("/api/v1/usuarios/{id_usuario}")
def update_account(
    id_usuario: int,
    payload: AccountUpdateRequest,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if id_usuario != user["id_usuario"]:
        raise HTTPException(status_code=403, detail="Solo el dueno puede editar esta cuenta")
    if not payload.nombre.strip() or not payload.apellido.strip() or not payload.telefono.strip():
        raise HTTPException(status_code=400, detail="Nombre, apellido y telefono son obligatorios")

    with db() as connection:
        if payload.password:
            if len(payload.password) < 6:
                raise HTTPException(status_code=400, detail="La contrasena debe tener al menos 6 caracteres")
            connection.execute(
                """
                UPDATE usuario
                SET nombre = ?, apellido = ?, telefono = ?, direccion = ?, password_hash = ?
                WHERE id_usuario = ?
                """,
                (
                    payload.nombre.strip(),
                    payload.apellido.strip(),
                    payload.telefono.strip(),
                    payload.direccion.strip() if payload.direccion else None,
                    hash_password(payload.password),
                    id_usuario,
                ),
            )
        else:
            connection.execute(
                """
                UPDATE usuario
                SET nombre = ?, apellido = ?, telefono = ?, direccion = ?
                WHERE id_usuario = ?
                """,
                (
                    payload.nombre.strip(),
                    payload.apellido.strip(),
                    payload.telefono.strip(),
                    payload.direccion.strip() if payload.direccion else None,
                    id_usuario,
                ),
            )
        connection.commit()
        row = connection.execute("SELECT * FROM usuario WHERE id_usuario = ?", (id_usuario,)).fetchone()
        return public_user(connection, row_to_dict(row))
