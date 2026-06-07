from pathlib import Path
import sqlite3


DB_PATH = Path(__file__).resolve().parent / "integrador.db"


def column_names(connection: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}


def migrate_assignment_table(connection: sqlite3.Connection) -> None:
    columns = connection.execute("PRAGMA table_info(asignacion_repartidor)").fetchall()
    id_usuario = next((column for column in columns if column[1] == "id_usuario"), None)
    if not id_usuario or id_usuario[3] == 0:
        return

    connection.executescript(
        """
        DROP INDEX IF EXISTS UX_asignacion_repartidor_pedido_activo;
        ALTER TABLE asignacion_repartidor RENAME TO asignacion_repartidor_anterior;

        CREATE TABLE asignacion_repartidor (
          id_asignacion INTEGER PRIMARY KEY AUTOINCREMENT,
          id_pedido INTEGER NOT NULL,
          id_usuario INTEGER,
          estado_asignacion TEXT NOT NULL DEFAULT 'pendiente',
          fecha_asignacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          fecha_aceptacion TEXT,
          fecha_cancelacion TEXT,
          fecha_entrega TEXT,
          observacion TEXT,
          FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
          FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
        );

        INSERT INTO asignacion_repartidor
        SELECT * FROM asignacion_repartidor_anterior;

        DROP TABLE asignacion_repartidor_anterior;

        CREATE UNIQUE INDEX UX_asignacion_repartidor_pedido_activo
        ON asignacion_repartidor (id_pedido)
        WHERE estado_asignacion IN ('pendiente', 'aceptado', 'en_camino');
        """
    )


def recreate_delivery_view(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        DROP VIEW IF EXISTS V_Ordenes_Repartidor;
        CREATE VIEW V_Ordenes_Repartidor AS
        SELECT
            ar.id_asignacion,
            p.id_pedido,
            ar.id_usuario AS id_repartidor,
            CASE
              WHEN rep.id_usuario IS NULL THEN NULL
              ELSE rep.nombre || ' ' || rep.apellido
            END AS repartidor,
            rep.telefono AS telefono_repartidor,
            ar.estado_asignacion,
            p.tipo_pedido,
            p.fecha_pedido,
            t.nombre AS tienda,
            cli.nombre || ' ' || cli.apellido AS cliente,
            cli.telefono AS telefono_cliente,
            COALESCE(u.nombre_lugar, p.direccion_entrega) AS punto_entrega,
            COALESCE(u.referencia, p.direccion_entrega) AS referencia_entrega,
            p.subtotal,
            p.total_descuento,
            p.total,
            ar.fecha_asignacion,
            ar.fecha_aceptacion,
            ar.fecha_entrega,
            ar.observacion
        FROM asignacion_repartidor ar
        INNER JOIN pedido p ON ar.id_pedido = p.id_pedido
        LEFT JOIN usuario rep ON ar.id_usuario = rep.id_usuario
        INNER JOIN usuario cli ON p.id_usuario = cli.id_usuario
        INNER JOIN tienda t ON p.id_tienda = t.id_tienda
        LEFT JOIN ubicacion u ON p.id_ubicacion_entrega = u.id_ubicacion;
        """
    )


def main() -> None:
    with sqlite3.connect(DB_PATH) as connection:
        if "direccion" not in column_names(connection, "usuario"):
            connection.execute("ALTER TABLE usuario ADD COLUMN direccion TEXT")

        connection.execute(
            """
            INSERT OR IGNORE INTO estado_pedido (id_estado_pedido, nombre, descripcion)
            VALUES (8, 'rechazado', 'Pedido rechazado por la tienda')
            """
        )
        connection.execute(
            """
            UPDATE estado_pedido
            SET descripcion = 'Pedido cancelado por el cliente'
            WHERE nombre = 'cancelado'
            """
        )
        migrate_assignment_table(connection)
        recreate_delivery_view(connection)
        connection.commit()

    print(f"Migration applied to {DB_PATH}")


if __name__ == "__main__":
    main()
