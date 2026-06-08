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


class Tienda(SQLModel, table=True):
    __tablename__ = "tienda"

    id_tienda: int | None = Field(default=None, primary_key=True)
    id_ubicacion: int
    nombre: str
    sucursal: str | None = None
    logo_url: str | None = None
    horario_apertura: str
    horario_cierre: str
    estado: bool = True


class TiendaUsuario(SQLModel, table=True):
    __tablename__ = "tienda_usuario"

    id_tienda_usuario: int | None = Field(default=None, primary_key=True)
    id_tienda: int
    id_usuario: int
    cargo: str
    estado: bool = True
