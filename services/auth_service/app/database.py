from collections.abc import Generator

from sqlalchemy import text
from sqlmodel import Session, create_engine

from .config import DB_PATH


engine = create_engine(
    f"sqlite:///{DB_PATH.as_posix()}",
    connect_args={"check_same_thread": False},
)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        session.exec(text("PRAGMA foreign_keys = ON"))
        yield session
