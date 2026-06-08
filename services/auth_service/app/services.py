from typing import Any

from fastapi import HTTPException
from sqlmodel import Session

from . import repositories
from .schemas import LoginRequest, RegisterRequest
from .security import create_token, hash_password, verify_password


def register(session: Session, payload: RegisterRequest) -> dict[str, Any]:
    if repositories.get_user_by_email(session, str(payload.correo)):
        raise HTTPException(status_code=409, detail="El correo ya existe")
    user = repositories.create_user(
        session,
        nombre=payload.nombre,
        apellido=payload.apellido,
        correo=str(payload.correo),
        telefono=payload.telefono,
        password_hash=hash_password(payload.password),
        acepta_repartos=payload.acepta_repartos,
    )
    public = repositories.public_user(session, user)
    return {"token": create_token(public), "usuario": public}


def login(session: Session, payload: LoginRequest) -> dict[str, Any]:
    user = repositories.get_user_by_email(session, str(payload.correo), active_only=True)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    public = repositories.public_user(session, user)
    return {"token": create_token(public), "usuario": public}
