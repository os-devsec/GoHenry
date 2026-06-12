import os
from pathlib import Path

from sqlalchemy import URL


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Falta la variable de entorno requerida: {name}")
    return value


def database_url() -> str | URL:
    direct_url = os.getenv("DATABASE_URL")
    if direct_url:
        return direct_url
    return URL.create(
        "mssql+pymssql",
        username=required_env("RDS_USER"),
        password=required_env("RDS_PASSWORD"),
        host=required_env("RDS_HOST"),
        port=int(os.getenv("RDS_PORT", "1433")),
        database=required_env("RDS_DB"),
        query={"charset": "UTF-8", "encryption": "require"},
    )


DATABASE_URL = database_url()
STORE_LOGO_DIR = Path(os.getenv("STORE_LOGO_DIR", "uploads/stores")).resolve()
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000").rstrip("/")
USERS_SERVICE_URL = os.getenv("USERS_SERVICE_URL", "http://users-service:8000").rstrip("/")
INTERNAL_SERVICE_TOKEN = required_env("INTERNAL_SERVICE_TOKEN")
