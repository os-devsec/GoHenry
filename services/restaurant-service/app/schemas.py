from pydantic import BaseModel, EmailStr


class TiendaRequest(BaseModel):
    nombre: str
    sucursal: str | None = "Campus UIDE"
    logo_url: str | None = None
    nombre_lugar: str = "Campus UIDE"
    referencia: str | None = None
    horario_apertura: str = "08:00"
    horario_cierre: str = "18:00"


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
