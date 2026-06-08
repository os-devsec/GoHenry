from pydantic import BaseModel, EmailStr


class RepartosRequest(BaseModel):
    acepta_repartos: bool


class AccountUpdateRequest(BaseModel):
    nombre: str
    apellido: str
    telefono: str
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
