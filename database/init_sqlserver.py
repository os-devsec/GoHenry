import argparse
import hashlib
import os
import re
from pathlib import Path

import pymssql


BASE_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = BASE_DIR / "schema_sqlserver.sql"


def load_env_file() -> None:
    env_path = BASE_DIR.parent / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Falta la variable de entorno requerida: {name}")
    return value


def hash_password(password: str) -> str:
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def sql_batches(script: str) -> list[str]:
    return [
        batch.strip()
        for batch in re.split(r"^\s*GO\s*$", script, flags=re.MULTILINE | re.IGNORECASE)
        if batch.strip()
    ]


def seed_initial_admin(cursor: pymssql.Cursor) -> None:
    cursor.execute(
        """
        INSERT INTO usuario
            (nombre, apellido, correo, telefono, password_hash, rol_usuario, acepta_repartos, estado)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            "Admin",
            "Plataforma",
            required_env("INITIAL_ADMIN_EMAIL"),
            "0990000000",
            hash_password(required_env("INITIAL_ADMIN_PASSWORD")),
            "admin_plataforma",
            False,
            True,
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Recrea el esquema SQL Server de GoHenryGo.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Confirma la eliminacion y recreacion de todas las tablas.",
    )
    args = parser.parse_args()
    if not args.reset:
        parser.error("Debes indicar --reset para ejecutar una operacion destructiva.")

    load_env_file()
    connection = pymssql.connect(
        server=required_env("RDS_HOST"),
        port=int(os.getenv("RDS_PORT", "1433")),
        user=required_env("RDS_USER"),
        password=required_env("RDS_PASSWORD"),
        database=required_env("RDS_DB"),
        login_timeout=15,
        timeout=60,
        charset="UTF-8",
        encryption="require",
        autocommit=False,
    )
    try:
        cursor = connection.cursor()
        for batch in sql_batches(SCHEMA_PATH.read_text(encoding="utf-8")):
            cursor.execute(batch)
        seed_initial_admin(cursor)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print("SQL Server schema recreated successfully.")


if __name__ == "__main__":
    main()
