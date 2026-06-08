from typing import Any

from sqlmodel import Session, select

from .models import Tienda, TiendaUsuario, Ubicacion, Usuario
from .schemas import TiendaRequest


def get_active_user_by_id(session: Session, id_usuario: int | str) -> Usuario | None:
    return session.exec(
        select(Usuario).where(Usuario.id_usuario == int(id_usuario), Usuario.estado == True)  # noqa: E712
    ).first()


def list_stores(session: Session) -> list[dict[str, Any]]:
    rows = session.exec(
        select(Tienda, Ubicacion)
        .join(Ubicacion, Ubicacion.id_ubicacion == Tienda.id_ubicacion, isouter=True)
        .where(Tienda.estado == True)  # noqa: E712
        .order_by(Tienda.id_tienda)
    ).all()
    return [store_with_location(store, location) for store, location in rows]


def create_store(session: Session, payload: TiendaRequest) -> dict[str, Any]:
    location = Ubicacion(
        nombre_lugar=payload.nombre_lugar,
        referencia=payload.referencia,
        tipo_ubicacion="tienda",
        estado=True,
    )
    session.add(location)
    session.flush()
    store = Tienda(
        id_ubicacion=location.id_ubicacion or 0,
        nombre=payload.nombre,
        sucursal=payload.sucursal,
        logo_url=payload.logo_url,
        horario_apertura=payload.horario_apertura,
        horario_cierre=payload.horario_cierre,
        estado=True,
    )
    session.add(store)
    session.commit()
    session.refresh(store)
    return store.model_dump()


def get_active_store(session: Session, id_tienda: int) -> Tienda | None:
    return session.exec(
        select(Tienda).where(Tienda.id_tienda == id_tienda, Tienda.estado == True)  # noqa: E712
    ).first()


def get_store_with_location(session: Session, id_tienda: int) -> dict[str, Any] | None:
    row = session.exec(
        select(Tienda, Ubicacion)
        .join(Ubicacion, Ubicacion.id_ubicacion == Tienda.id_ubicacion, isouter=True)
        .where(Tienda.id_tienda == id_tienda)
    ).first()
    if not row:
        return None
    store, location = row
    return store_with_location(store, location)


def update_store(session: Session, store: Tienda, payload: TiendaRequest) -> dict[str, Any]:
    store.nombre = payload.nombre.strip()
    store.sucursal = payload.sucursal
    store.horario_apertura = payload.horario_apertura
    store.horario_cierre = payload.horario_cierre

    location = None
    if store.id_ubicacion:
        location = session.get(Ubicacion, store.id_ubicacion)
    if location:
        location.nombre_lugar = payload.nombre_lugar
        location.referencia = payload.referencia
        session.add(location)
    else:
        location = Ubicacion(
            nombre_lugar=payload.nombre_lugar,
            referencia=payload.referencia,
            tipo_ubicacion="tienda",
            estado=True,
        )
        session.add(location)
        session.flush()
        store.id_ubicacion = location.id_ubicacion or 0

    session.add(store)
    session.commit()
    session.refresh(store)
    return get_store_with_location(session, store.id_tienda or 0) or store.model_dump()


def update_logo(session: Session, store: Tienda, logo_url: str) -> dict[str, Any]:
    store.logo_url = logo_url
    session.add(store)
    session.commit()
    session.refresh(store)
    return store.model_dump()


def has_store_role(session: Session, id_tienda: int, id_usuario: int, roles: set[str]) -> bool:
    return (
        session.exec(
            select(TiendaUsuario).where(
                TiendaUsuario.id_tienda == id_tienda,
                TiendaUsuario.id_usuario == id_usuario,
                TiendaUsuario.cargo.in_(roles),
                TiendaUsuario.estado == True,  # noqa: E712
            )
        ).first()
        is not None
    )


def list_staff(session: Session, id_tienda: int) -> list[dict[str, Any]]:
    rows = session.exec(
        select(TiendaUsuario, Usuario)
        .join(Usuario, Usuario.id_usuario == TiendaUsuario.id_usuario)
        .where(TiendaUsuario.id_tienda == id_tienda, TiendaUsuario.estado == True)  # noqa: E712
    ).all()
    return [staff_row(membership, user) for membership, user in rows]


def get_staff(session: Session, id_tienda: int, id_usuario: int) -> TiendaUsuario | None:
    return session.exec(
        select(TiendaUsuario).where(TiendaUsuario.id_tienda == id_tienda, TiendaUsuario.id_usuario == id_usuario)
    ).first()


def upsert_staff(session: Session, id_tienda: int, id_usuario: int, cargo: str) -> dict[str, Any]:
    staff = get_staff(session, id_tienda, id_usuario)
    if staff:
        staff.cargo = cargo
        staff.estado = True
    else:
        staff = TiendaUsuario(id_tienda=id_tienda, id_usuario=id_usuario, cargo=cargo, estado=True)
    session.add(staff)
    session.commit()
    session.refresh(staff)
    return get_staff_row(session, staff.id_tienda_usuario or 0) or staff.model_dump()


def get_staff_row(session: Session, id_tienda_usuario: int) -> dict[str, Any] | None:
    row = session.exec(
        select(TiendaUsuario, Usuario)
        .join(Usuario, Usuario.id_usuario == TiendaUsuario.id_usuario)
        .where(TiendaUsuario.id_tienda_usuario == id_tienda_usuario)
    ).first()
    if not row:
        return None
    membership, user = row
    return staff_row(membership, user)


def remove_staff(session: Session, id_tienda: int, id_tienda_usuario: int) -> None:
    staff = session.exec(
        select(TiendaUsuario).where(
            TiendaUsuario.id_tienda == id_tienda,
            TiendaUsuario.id_tienda_usuario == id_tienda_usuario,
        )
    ).first()
    if staff:
        staff.estado = False
        session.add(staff)
        session.commit()


def store_with_location(store: Tienda, location: Ubicacion | None) -> dict[str, Any]:
    data = store.model_dump()
    data["nombre_lugar"] = location.nombre_lugar if location else None
    data["referencia"] = location.referencia if location else None
    return data


def staff_row(membership: TiendaUsuario, user: Usuario) -> dict[str, Any]:
    return {
        **membership.model_dump(),
        "nombre": user.nombre,
        "apellido": user.apellido,
        "correo": user.correo,
        "telefono": user.telefono,
        "rol_usuario": user.rol_usuario,
    }
