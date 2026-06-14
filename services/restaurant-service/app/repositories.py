from typing import Any

from sqlalchemy import text
from sqlmodel import Session, select

from .models import StoreStaff, Tienda, Ubicacion
from .schemas import TiendaRequest


def list_stores(session: Session) -> list[dict[str, Any]]:
    rows = session.exec(
        select(Tienda, Ubicacion)
        .join(Ubicacion, Ubicacion.id_ubicacion == Tienda.id_ubicacion, isouter=True)
        .where(Tienda.estado == True)
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


def delete_store(session: Session, id_tienda: int) -> dict[str, Any] | None:
    connection = session.connection()
    store = connection.execute(
        text(
            """
            SELECT id_tienda, id_ubicacion, logo_url
            FROM tienda
            WHERE id_tienda = :id_tienda
            """
        ),
        {"id_tienda": id_tienda},
    ).mappings().first()
    if not store:
        return None

    product_rows = connection.execute(
        text(
            """
            SELECT id_producto, imagen_url
            FROM producto
            WHERE id_tienda = :id_tienda
            """
        ),
        {"id_tienda": id_tienda},
    ).mappings().all()
    delivery_location_ids = [
        row[0]
        for row in connection.execute(
            text(
                """
                SELECT DISTINCT id_ubicacion_entrega
                FROM pedido
                WHERE id_tienda = :id_tienda
                    AND id_ubicacion_entrega <> :id_ubicacion
                """
            ),
            {
                "id_tienda": id_tienda,
                "id_ubicacion": store["id_ubicacion"],
            },
        ).all()
    ]

    statements = [
        """
        DELETE FROM comision
        WHERE id_pedido IN (
            SELECT id_pedido FROM pedido WHERE id_tienda = :id_tienda
        )
        """,
        """
        DELETE FROM pago
        WHERE id_pedido IN (
            SELECT id_pedido FROM pedido WHERE id_tienda = :id_tienda
        )
        """,
        """
        DELETE FROM asignacion_repartidor
        WHERE id_pedido IN (
            SELECT id_pedido FROM pedido WHERE id_tienda = :id_tienda
        )
        """,
        """
        DELETE FROM detalle_pedido
        WHERE id_pedido IN (
                SELECT id_pedido FROM pedido WHERE id_tienda = :id_tienda
            )
            OR id_producto IN (
                SELECT id_producto FROM producto WHERE id_tienda = :id_tienda
            )
        """,
        "DELETE FROM pedido WHERE id_tienda = :id_tienda",
        """
        DELETE FROM detalle_carrito
        WHERE id_carrito IN (
                SELECT id_carrito FROM carrito WHERE id_tienda = :id_tienda
            )
            OR id_producto IN (
                SELECT id_producto FROM producto WHERE id_tienda = :id_tienda
            )
        """,
        "DELETE FROM carrito WHERE id_tienda = :id_tienda",
        """
        DELETE FROM producto_categoria
        WHERE id_producto IN (
            SELECT id_producto FROM producto WHERE id_tienda = :id_tienda
        )
        """,
        "DELETE FROM producto WHERE id_tienda = :id_tienda",
        "DELETE FROM tienda_usuario WHERE id_tienda = :id_tienda",
        "DELETE FROM tienda WHERE id_tienda = :id_tienda",
        "DELETE FROM ubicacion WHERE id_ubicacion = :id_ubicacion",
    ]

    try:
        for statement in statements:
            connection.execute(
                text(statement),
                {
                    "id_tienda": id_tienda,
                    "id_ubicacion": store["id_ubicacion"],
                },
            )
        for id_ubicacion in delivery_location_ids:
            connection.execute(
                text(
                    """
                    DELETE FROM ubicacion
                    WHERE id_ubicacion = :id_ubicacion
                        AND tipo_ubicacion = 'entrega'
                        AND NOT EXISTS (
                            SELECT 1
                            FROM pedido
                            WHERE id_ubicacion_entrega = :id_ubicacion
                        )
                    """
                ),
                {"id_ubicacion": id_ubicacion},
            )
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "id_tienda": id_tienda,
        "logo_url": store["logo_url"],
        "products": [dict(product) for product in product_rows],
    }


def has_store_role(session: Session, id_tienda: int, id_usuario: int, roles: set[str]) -> bool:
    return (
        session.exec(
            select(StoreStaff).where(
                StoreStaff.id_tienda == id_tienda,
                StoreStaff.id_usuario == id_usuario,
                StoreStaff.cargo.in_(roles),
                StoreStaff.estado == True,  # noqa: E712
            )
        ).first()
        is not None
    )


def list_store_staff(session: Session, id_tienda: int) -> list[StoreStaff]:
    return session.exec(
        select(StoreStaff).where(StoreStaff.id_tienda == id_tienda, StoreStaff.estado == True)  # noqa: E712
    ).all()


def list_user_store_staff(session: Session, id_usuario: int) -> list[dict[str, Any]]:
    rows = session.exec(
        select(StoreStaff, Tienda)
        .join(Tienda, Tienda.id_tienda == StoreStaff.id_tienda)
        .where(
            StoreStaff.id_usuario == id_usuario,
            StoreStaff.estado == True,  # noqa: E712
            Tienda.estado == True,  # noqa: E712
        )
        .order_by(Tienda.nombre)
    ).all()
    return [
        {
            **staff.model_dump(),
            "tienda_nombre": store.nombre,
            "sucursal": store.sucursal,
        }
        for staff, store in rows
    ]


def get_store_staff(session: Session, id_tienda: int, id_usuario: int) -> StoreStaff | None:
    return session.exec(
        select(StoreStaff).where(StoreStaff.id_tienda == id_tienda, StoreStaff.id_usuario == id_usuario)
    ).first()


def upsert_store_staff(session: Session, id_tienda: int, id_usuario: int, cargo: str) -> StoreStaff:
    staff = get_store_staff(session, id_tienda, id_usuario)
    if staff:
        staff.cargo = cargo
        staff.estado = True
    else:
        staff = StoreStaff(id_tienda=id_tienda, id_usuario=id_usuario, cargo=cargo, estado=True)
    session.add(staff)
    session.commit()
    session.refresh(staff)
    return staff


def remove_store_staff(session: Session, id_tienda: int, id_tienda_usuario: int) -> None:
    staff = session.exec(
        select(StoreStaff).where(
            StoreStaff.id_tienda == id_tienda,
            StoreStaff.id_tienda_usuario == id_tienda_usuario,
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
