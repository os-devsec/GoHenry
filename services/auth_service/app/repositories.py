from sqlmodel import Session, select

from .models import Usuario


def get_user_by_email(session: Session, correo: str, active_only: bool = False) -> Usuario | None:
    query = select(Usuario).where(Usuario.correo == correo)
    if active_only:
        query = query.where(Usuario.estado == True)
    return session.exec(query).first()


def get_user_by_id(session: Session, id_usuario: int | str, active_only: bool = False) -> Usuario | None:
    query = select(Usuario).where(Usuario.id_usuario == int(id_usuario))
    if active_only:
        query = query.where(Usuario.estado == True)
    return session.exec(query).first()
