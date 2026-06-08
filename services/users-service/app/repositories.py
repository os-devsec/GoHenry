from typing import Any

from sqlmodel import Session, select

from .models import Tienda, TiendaUsuario, Usuario


def list_users(session: Session) -> list[dict[str, Any]]:
    users = session.exec(select(Usuario).order_by(Usuario.id_usuario)).all()
    return [public_fields(user) for user in users]


def list_delivery_users(session: Session) -> list[dict[str, Any]]:
    users = session.exec(
        select(Usuario)
        .where(Usuario.acepta_repartos == True, Usuario.estado == True)  # noqa: E712
        .order_by(Usuario.id_usuario)
    ).all()
    return [
        {
            "id_usuario": user.id_usuario,
            "nombre": user.nombre,
            "apellido": user.apellido,
            "correo": user.correo,
            "telefono": user.telefono,
            "acepta_repartos": user.acepta_repartos,
            "estado": user.estado,
        }
        for user in users
    ]


def get_user_by_id(session: Session, id_usuario: int | str, active_only: bool = False) -> Usuario | None:
    query = select(Usuario).where(Usuario.id_usuario == int(id_usuario))
    if active_only:
        query = query.where(Usuario.estado == True)  # noqa: E712
    return session.exec(query).first()


def get_user_by_email(session: Session, correo: str) -> Usuario | None:
    return session.exec(select(Usuario).where(Usuario.correo == correo)).first()


def create_client(
    session: Session,
    *,
    nombre: str,
    apellido: str,
    correo: str,
    telefono: str | None,
    password_hash: str,
) -> Usuario:
    user = Usuario(
        nombre=nombre,
        apellido=apellido,
        correo=correo,
        telefono=telefono,
        password_hash=password_hash,
        rol_usuario="cliente",
        acepta_repartos=False,
        estado=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def create_platform_admin(
    session: Session,
    *,
    nombre: str,
    apellido: str,
    correo: str,
    telefono: str | None,
    password_hash: str,
) -> Usuario:
    user = Usuario(
        nombre=nombre,
        apellido=apellido,
        correo=correo,
        telefono=telefono,
        password_hash=password_hash,
        rol_usuario="admin_plataforma",
        acepta_repartos=False,
        estado=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def promote_to_platform_admin(session: Session, user: Usuario) -> Usuario:
    user.rol_usuario = "admin_plataforma"
    user.estado = True
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def update_delivery_mode(session: Session, user: Usuario, acepta_repartos: bool) -> Usuario:
    user.acepta_repartos = acepta_repartos
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def update_account(
    session: Session,
    user: Usuario,
    *,
    nombre: str,
    apellido: str,
    telefono: str,
    password_hash: str | None,
) -> Usuario:
    user.nombre = nombre
    user.apellido = apellido
    user.telefono = telefono
    if password_hash:
        user.password_hash = password_hash
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


def public_fields(user: Usuario) -> dict[str, Any]:
    return {
        "id_usuario": user.id_usuario,
        "nombre": user.nombre,
        "apellido": user.apellido,
        "correo": user.correo,
        "telefono": user.telefono,
        "rol_usuario": user.rol_usuario,
        "acepta_repartos": user.acepta_repartos,
        "estado": user.estado,
    }


def public_user(session: Session, user: Usuario) -> dict[str, Any]:
    data = user.model_dump()
    data.pop("password_hash", None)
    data.setdefault("rol_usuario", "cliente")
    data["tiendas"] = list_store_memberships(session, user.id_usuario or 0)
    return data
