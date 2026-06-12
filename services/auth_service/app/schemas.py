import re

from pydantic import BaseModel, EmailStr
from pydantic import field_validator


class RegisterRequest(BaseModel):
    nombre: str
    apellido: str
    correo: EmailStr
    telefono: str
    password: str
    acepta_repartos: bool = False

    @field_validator("telefono")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        phone = value.strip()
        if not re.fullmatch(r"\d{10}", phone):
            raise ValueError("El telefono debe tener exactamente 10 digitos")
        return phone

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("La contrasena debe tener al menos 8 caracteres")
        return value


class LoginRequest(BaseModel):
    correo: EmailStr
    password: str
