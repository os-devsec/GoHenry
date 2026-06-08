from typing import Any

from fastapi import APIRouter, Depends
from sqlmodel import Session

from .database import get_session
from .schemas import LoginRequest, RegisterRequest
from .security import current_user
from . import services


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "auth-service"}


@router.post("/api/v1/auth/register")
def register(payload: RegisterRequest, session: Session = Depends(get_session)) -> dict[str, Any]:
    return services.register(session, payload)


@router.post("/api/v1/auth/login")
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> dict[str, Any]:
    return services.login(session, payload)


@router.get("/api/v1/auth/me")
def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return user
