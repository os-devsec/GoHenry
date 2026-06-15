from datetime import time

from pydantic import BaseModel, EmailStr, field_validator, model_validator


class TiendaRequest(BaseModel):
    nombre: str
    sucursal: str | None = "Campus UIDE"
    logo_url: str | None = None
    nombre_lugar: str = "Campus UIDE"
    referencia: str | None = None
    horario_apertura: str = "08:00"
    horario_cierre: str = "18:00"

    @field_validator("nombre", "nombre_lugar")
    @classmethod
    def required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("El campo no puede estar vacio")
        return normalized

    @field_validator("horario_apertura", "horario_cierre")
    @classmethod
    def valid_time(cls, value: str) -> str:
        try:
            return time.fromisoformat(value).strftime("%H:%M")
        except ValueError as error:
            raise ValueError("El horario debe usar el formato HH:mm") from error

    @model_validator(mode="after")
    def closing_after_opening(self) -> "TiendaRequest":
        opening = time.fromisoformat(self.horario_apertura)
        closing = time.fromisoformat(self.horario_cierre)
        if closing <= opening:
            raise ValueError("El horario de cierre debe ser posterior al de apertura")
        return self


class StoreAvailabilityRequest(BaseModel):
    estado: bool


class PersonalRequest(BaseModel):
    cargo: str = "empleado"
    id_usuario: int | None = None
    nombre: str | None = None
    apellido: str | None = None
    correo: EmailStr | None = None
    telefono: str | None = None
    password: str | None = None


class StoreStaffRoleRequest(BaseModel):
    id_usuario: int
    roles: list[str]
