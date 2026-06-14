import os
from pathlib import Path

from sqlalchemy import URL


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Falta la variable de entorno requerida: {name}")
    return value


def rds_database_url() -> URL:
    return URL.create(
        "mssql+pymssql",
        username=required_env("RDS_USER"),
        password=required_env("RDS_PASSWORD"),
        host=required_env("RDS_HOST"),
        port=int(required_env("RDS_PORT")),
        database=required_env("RDS_DB"),
        query={"charset": "UTF-8", "encryption": "require"},
    )


RDS_DATABASE_URL = rds_database_url()
STORE_LOGO_DIR = Path(os.getenv("STORE_LOGO_DIR", "uploads/stores")).resolve()
PRODUCT_IMAGE_DIR = Path(os.getenv("PRODUCT_IMAGE_DIR", "/app/catalog-uploads/products")).resolve()
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000").rstrip("/")
USERS_SERVICE_URL = os.getenv("USERS_SERVICE_URL", "http://users-service:8000").rstrip("/")
INTERNAL_SERVICE_TOKEN = required_env("INTERNAL_SERVICE_TOKEN")
