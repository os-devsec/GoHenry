import os
from pathlib import Path


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../../database/integrador.db")
JWT_SECRET = os.getenv("JWT_SECRET", "integrador_secret")
JWT_ALGORITHM = "HS256"


def sqlite_path() -> str:
    if DATABASE_URL.startswith("sqlite:///"):
        return DATABASE_URL.replace("sqlite:///", "", 1)
    return DATABASE_URL


DB_PATH = Path(sqlite_path()).resolve()
