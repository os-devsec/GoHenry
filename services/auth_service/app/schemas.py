from pydantic import BaseModel, EmailStr


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
