from typing import Any

from sqlmodel import Session, select

from .models import Tienda, TiendaUsuario, Usuario


def get_user_by_email(session: Session, correo: str, active_only: bool = False) -> Usuario | None:
    query = select(Usuario).where(Usuario.correo == correo)
    if active_only:
        query = query.where(Usuario.estado == True)  # noqa: E712
    return session.exec(query).first()


def get_user_by_id(session: Session, id_usuario: int | str, active_only: bool = False) -> Usuario | None:
    query = select(Usuario).where(Usuario.id_usuario == int(id_usuario))
    if active_only:
        query = query.where(Usuario.estado == True)  # noqa: E712
    return session.exec(query).first()


def create_user(
    session: Session,
    *,
    nombre: str,
    apellido: str,
    correo: str,
    telefono: str | None,
    password_hash: str,
    acepta_repartos: bool,
) -> Usuario:
    user = Usuario(
        nombre=nombre,
        apellido=apellido,
        correo=correo,
        telefono=telefono,
        password_hash=password_hash,
        acepta_repartos=acepta_repartos,
        estado=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def list_store_memberships(session: Session, id_usuario: int) -> list[dict[str, Any]]:
    rows = session.exec(
        select(TiendaUsuario, Tienda)
        .join(Tienda, Tienda.id_tienda == TiendaUsuario.id_tienda)
        .where(
            TiendaUsuario.id_usuario == id_usuario,
            TiendaUsuario.estado == True,  # noqa: E712
            Tienda.estado == True,  # noqa: E712
        )
        .order_by(Tienda.nombre)
    ).all()
    return [
        {
            **membership.model_dump(),
            "tienda_nombre": store.nombre,
            "sucursal": store.sucursal,
        }
        for membership, store in rows
    ]


def public_user(session: Session, user: Usuario) -> dict[str, Any]:
    data = user.model_dump()
    data.pop("password_hash", None)
    data.setdefault("rol_usuario", "cliente")
    data["tiendas"] = list_store_memberships(session, user.id_usuario or 0)
    return data
