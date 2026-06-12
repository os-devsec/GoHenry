from typing import Any

from fastapi import HTTPException
from sqlmodel import Session

from . import repositories, user_client
from .schemas import LoginRequest, RegisterRequest
from .security import create_token, verify_password


def register(session: Session, payload: RegisterRequest) -> dict[str, Any]:
    if repositories.get_user_by_email(session, str(payload.correo)):
        raise HTTPException(status_code=409, detail="El correo ya existe")

    public = user_client.create_user_profile(
        {
            "nombre": payload.nombre,
            "apellido": payload.apellido,
            "correo": str(payload.correo),
            "telefono": payload.telefono,
            "password": payload.password,
            "acepta_repartos": payload.acepta_repartos,
        }
    )
    return {"token": create_token(public), "usuario": public}


def login(session: Session, payload: LoginRequest) -> dict[str, Any]:
    user = repositories.get_user_by_email(session, str(payload.correo), active_only=True)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token = create_token({"id_usuario": user.id_usuario, "correo": user.correo})
    public = user_client.get_public_user(user.id_usuario or 0, token)
    return {"token": token, "usuario": public}
