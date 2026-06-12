from sqlmodel import Field, SQLModel


class Ubicacion(SQLModel, table=True):
    __tablename__ = "ubicacion"

    id_ubicacion: int | None = Field(default=None, primary_key=True)
    nombre_lugar: str
    referencia: str | None = None
    tipo_ubicacion: str
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


class StoreStaff(SQLModel, table=True):
    __tablename__ = "tienda_usuario"

    id_tienda_usuario: int | None = Field(default=None, primary_key=True)
    id_tienda: int
    id_usuario: int
    cargo: str
    estado: bool = True
