import re

from pydantic import BaseModel, EmailStr
from pydantic import field_validator


def valid_phone(value: str | None) -> str | None:
    if value is None:
        return None
    phone = value.strip()
    if not re.fullmatch(r"\d{10}", phone):
        raise ValueError("El telefono debe tener exactamente 10 digitos")
    return phone


def valid_password(value: str | None) -> str | None:
    if value is not None and len(value) < 8:
        raise ValueError("La contrasena debe tener al menos 8 caracteres")
    return value


class RepartosRequest(BaseModel):
    acepta_repartos: bool


class AccountUpdateRequest(BaseModel):
    nombre: str
    apellido: str
    telefono: str
    password: str | None = None

    _validate_phone = field_validator("telefono")(valid_phone)
    _validate_password = field_validator("password")(valid_password)


class PlatformAdminRequest(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    correo: EmailStr
    telefono: str | None = None
    password: str | None = None

    _validate_phone = field_validator("telefono")(valid_phone)
    _validate_password = field_validator("password")(valid_password)


class InternalUserRequest(BaseModel):
    id_usuario: int | None = None
    nombre: str | None = None
    apellido: str | None = None
    correo: EmailStr | None = None
    telefono: str | None = None
    password: str | None = None
    acepta_repartos: bool | None = None

    _validate_phone = field_validator("telefono")(valid_phone)
    _validate_password = field_validator("password")(valid_password)


class InternalUsersLookupRequest(BaseModel):
    ids_usuario: list[int]
