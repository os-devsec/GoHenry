import hashlib
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../../database/integrador.db")
JWT_SECRET = os.getenv("JWT_SECRET", "integrador_secret")
JWT_ALGORITHM = "HS256"


def sqlite_path() -> str:
    if DATABASE_URL.startswith("sqlite:///"):
        return DATABASE_URL.replace("sqlite:///", "", 1)
    return DATABASE_URL


DB_PATH = Path(sqlite_path()).resolve()

app = FastAPI(title="Auth Service")
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


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("sha256:"):
        return secrets.compare_digest(hash_password(password), stored)
    return False


def create_token(user: dict[str, Any]) -> str:
    payload = {
        "sub": str(user["id_usuario"]),
        "correo": user["correo"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


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
    data.setdefault("rol_usuario", "cliente")
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
        return public_user(connection, user)


class RegisterRequest(BaseModel):
    nombre: str
    apellido: str
    correo: EmailStr
    telefono: str
    password: str
    acepta_repartos: bool = False


class LoginRequest(BaseModel):
    correo: EmailStr
    password: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "auth-service"}


@app.post("/api/v1/auth/register")
def register(payload: RegisterRequest) -> dict[str, Any]:
    with db() as connection:
        exists = connection.execute("SELECT 1 FROM usuario WHERE correo = ?", (payload.correo,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="El correo ya existe")
        cursor = connection.execute(
            """
            INSERT INTO usuario (nombre, apellido, correo, telefono, password_hash, acepta_repartos, estado)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (
                payload.nombre,
                payload.apellido,
                payload.correo,
                payload.telefono,
                hash_password(payload.password),
                int(payload.acepta_repartos),
            ),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM usuario WHERE id_usuario = ?", (cursor.lastrowid,)).fetchone()
        user = row_to_dict(row)
        return {"token": create_token(user), "usuario": public_user(connection, user)}


@app.post("/api/v1/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT * FROM usuario WHERE correo = ? AND estado = 1", (payload.correo,)).fetchone()
        user = row_to_dict(row)
        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")
        return {"token": create_token(user), "usuario": public_user(connection, user)}


@app.get("/api/v1/auth/me")
def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return user
