from pathlib import Path
import hashlib
import os
import sqlite3


BASE_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = BASE_DIR / "schema.sql"


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


load_env_file()
ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL", "admin@uidelivery.com")
ADMIN_PASSWORD = os.getenv("INITIAL_ADMIN_PASSWORD", "Admin123!")


def sqlite_path() -> Path:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return BASE_DIR / "integrador.db"
    if not database_url.startswith("sqlite:///"):
        raise ValueError("init_sqlite.py solo inicializa SQLite. Para RDS/PostgreSQL usa migraciones SQL propias.")
    path = Path(database_url.replace("sqlite:///", "", 1))
    if os.name == "nt" and str(path).replace("\\", "/") == "/data/integrador.db":
        return BASE_DIR / "integrador.db"
    return path


DB_PATH = sqlite_path()


def hash_password(password: str) -> str:
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def seed_initial_admin(connection: sqlite3.Connection) -> None:
    existing = connection.execute("SELECT id_usuario FROM usuario WHERE correo = ?", (ADMIN_EMAIL,)).fetchone()
    if existing:
        connection.execute(
            "UPDATE usuario SET rol_sistema = 'admin_plataforma', estado = 1 WHERE correo = ?",
            (ADMIN_EMAIL,),
        )
        return

    connection.execute(
        """
        INSERT INTO usuario
        (nombre, apellido, correo, telefono, password_hash, rol_sistema, acepta_repartos, estado)
        VALUES ('Admin', 'Plataforma', ?, '0990000000', ?, 'admin_plataforma', 0, 1)
        """,
        (ADMIN_EMAIL, hash_password(ADMIN_PASSWORD)),
    )


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    with sqlite3.connect(DB_PATH) as connection:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        seed_initial_admin(connection)
        connection.commit()
    print(f"SQLite database ready at {DB_PATH}")


if __name__ == "__main__":
    main()
