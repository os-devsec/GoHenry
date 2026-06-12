from typing import Any

from sqlmodel import Session, select

from .models import Usuario


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


def list_users_by_ids(session: Session, ids_usuario: list[int]) -> list[dict[str, Any]]:
    unique_ids = sorted(set(ids_usuario))
    if not unique_ids:
        return []
    users = session.exec(
        select(Usuario)
        .where(Usuario.id_usuario.in_(unique_ids), Usuario.estado == True)  # noqa: E712
        .order_by(Usuario.id_usuario)
    ).all()
    return [public_fields(user) for user in users]


def get_user_by_id(session: Session, id_usuario: int | str, active_only: bool = False) -> Usuario | None:
    query = select(Usuario).where(Usuario.id_usuario == int(id_usuario))
    if active_only:
        query = query.where(Usuario.estado == True)  # noqa: E712
    return session.exec(query).first()


def get_user_by_email(session: Session, correo: str) -> Usuario | None:
    return session.exec(select(Usuario).where(Usuario.correo == correo)).first()


def create_user(
    session: Session,
    *,
    nombre: str,
    apellido: str,
    correo: str,
    telefono: str | None,
    password_hash: str,
    rol_usuario: str = "cliente",
    acepta_repartos: bool = False,
) -> Usuario:
    user = Usuario(
        nombre=nombre,
        apellido=apellido,
        correo=correo,
        telefono=telefono,
        password_hash=password_hash,
        rol_usuario=rol_usuario,
        acepta_repartos=acepta_repartos,
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


def public_user(user: Usuario, stores: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    data = public_fields(user)
    data["tiendas"] = stores or []
    return data
