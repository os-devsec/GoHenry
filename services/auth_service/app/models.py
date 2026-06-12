from sqlmodel import Field, SQLModel


class Usuario(SQLModel, table=True):
    __tablename__ = "usuario"

    id_usuario: int | None = Field(default=None, primary_key=True)
    nombre: str
    apellido: str
    correo: str
    telefono: str | None = None
    password_hash: str
    rol_usuario: str = "cliente"
    acepta_repartos: bool = False
    estado: bool = True
