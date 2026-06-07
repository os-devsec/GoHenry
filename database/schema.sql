PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  telefono TEXT NOT NULL,
  direccion TEXT,
  password_hash TEXT NOT NULL,
  rol_sistema TEXT NOT NULL DEFAULT 'cliente' CHECK (rol_sistema IN ('cliente', 'admin_plataforma')),
  acepta_repartos INTEGER NOT NULL DEFAULT 0,
  estado INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ubicacion (
  id_ubicacion INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_lugar TEXT NOT NULL,
  referencia TEXT,
  tipo_ubicacion TEXT NOT NULL DEFAULT 'campus',
  estado INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tienda (
  id_tienda INTEGER PRIMARY KEY AUTOINCREMENT,
  id_ubicacion INTEGER,
  nombre TEXT NOT NULL,
  sucursal TEXT,
  ruta_logo TEXT,
  horario_apertura TEXT NOT NULL DEFAULT '08:00',
  horario_cierre TEXT NOT NULL DEFAULT '18:00',
  estado INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (id_ubicacion) REFERENCES ubicacion(id_ubicacion)
);

CREATE TABLE IF NOT EXISTS tienda_usuario (
  id_tienda_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tienda INTEGER NOT NULL,
  id_usuario INTEGER NOT NULL,
  cargo TEXT NOT NULL CHECK (cargo IN ('administrador', 'empleado')),
  estado INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  UNIQUE (id_tienda, id_usuario)
);

CREATE TABLE IF NOT EXISTS categoria (
  id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  estado INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS producto (
  id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tienda INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  descuento_porcentaje REAL NOT NULL DEFAULT 0,
  descuento_inicio TEXT,
  descuento_fin TEXT,
  ruta_imagen TEXT,
  estado INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda)
);

CREATE TABLE IF NOT EXISTS producto_categoria (
  id_producto_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
  id_producto INTEGER NOT NULL,
  id_categoria INTEGER NOT NULL,
  FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
  FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
);

CREATE TABLE IF NOT EXISTS estado_carrito (
  id_estado_carrito INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS carrito (
  id_carrito INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL,
  id_tienda INTEGER NOT NULL,
  id_estado_carrito INTEGER NOT NULL,
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda),
  FOREIGN KEY (id_estado_carrito) REFERENCES estado_carrito(id_estado_carrito)
);

CREATE TABLE IF NOT EXISTS detalle_carrito (
  id_detalle_carrito INTEGER PRIMARY KEY AUTOINCREMENT,
  id_carrito INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (id_carrito) REFERENCES carrito(id_carrito),
  FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

CREATE TABLE IF NOT EXISTS estado_pedido (
  id_estado_pedido INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS pedido (
  id_pedido INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL,
  id_tienda INTEGER NOT NULL,
  id_estado_pedido INTEGER NOT NULL,
  id_ubicacion_entrega INTEGER,
  fecha_pedido TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo_pedido TEXT NOT NULL DEFAULT 'delivery',
  subtotal REAL NOT NULL DEFAULT 0,
  total_descuento REAL NOT NULL DEFAULT 0,
  costo_envio REAL NOT NULL DEFAULT 0.5,
  total REAL NOT NULL DEFAULT 0,
  direccion_entrega TEXT,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda),
  FOREIGN KEY (id_estado_pedido) REFERENCES estado_pedido(id_estado_pedido),
  FOREIGN KEY (id_ubicacion_entrega) REFERENCES ubicacion(id_ubicacion)
);

CREATE TABLE IF NOT EXISTS detalle_pedido (
  id_detalle_pedido INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario REAL NOT NULL,
  descuento_unitario REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL,
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
  FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

CREATE TABLE IF NOT EXISTS asignacion_repartidor (
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

CREATE UNIQUE INDEX IF NOT EXISTS UX_asignacion_repartidor_pedido_activo
ON asignacion_repartidor (id_pedido)
WHERE estado_asignacion IN ('pendiente', 'aceptado', 'en_camino');

CREATE TABLE IF NOT EXISTS metodo_pago (
  id_metodo_pago INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  estado INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pago (
  id_pago INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido INTEGER NOT NULL UNIQUE,
  id_metodo_pago INTEGER NOT NULL,
  monto_total REAL NOT NULL,
  estado_pago TEXT NOT NULL DEFAULT 'pendiente',
  fecha_pago TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
  FOREIGN KEY (id_metodo_pago) REFERENCES metodo_pago(id_metodo_pago)
);

CREATE TABLE IF NOT EXISTS comision (
  id_comision INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL,
  id_pedido INTEGER NOT NULL,
  monto REAL NOT NULL,
  fecha_comision TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_comision TEXT NOT NULL DEFAULT 'pendiente',
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
);

INSERT OR IGNORE INTO estado_carrito (id_estado_carrito, nombre) VALUES
  (1, 'activo'),
  (2, 'convertido'),
  (3, 'cancelado');

INSERT OR IGNORE INTO estado_pedido (id_estado_pedido, nombre, descripcion) VALUES
  (1, 'pendiente', 'Pedido creado por el cliente'),
  (2, 'aceptado', 'Pedido aceptado por la tienda'),
  (3, 'preparando', 'Pedido en preparacion'),
  (4, 'listo_para_entrega', 'Pedido listo para retirar'),
  (5, 'en_camino', 'Pedido en camino'),
  (6, 'entregado', 'Pedido entregado'),
  (7, 'cancelado', 'Pedido cancelado por el cliente'),
  (8, 'rechazado', 'Pedido rechazado por la tienda');

INSERT OR IGNORE INTO metodo_pago (id_metodo_pago, nombre, estado) VALUES
  (1, 'efectivo', 1),
  (2, 'tarjeta', 1);

DROP TRIGGER IF EXISTS TR_V_Actualizar_Estado_Pedido;
DROP VIEW IF EXISTS V_Productos_Catalogo_Tienda;
DROP VIEW IF EXISTS V_Productos_Catalogo;
DROP VIEW IF EXISTS V_Usuarios_Permisos;
DROP VIEW IF EXISTS V_Comisiones_Repartidores;
DROP VIEW IF EXISTS V_Ventas_Tiendas;
DROP VIEW IF EXISTS V_Actualizar_Estado_Pedido;
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

CREATE VIEW V_Actualizar_Estado_Pedido AS
SELECT
    p.id_pedido,
    p.id_estado_pedido,
    ep.nombre AS estado_actual,
    p.id_usuario,
    p.id_tienda,
    p.fecha_pedido,
    p.tipo_pedido,
    p.subtotal,
    p.total_descuento,
    p.total
FROM pedido p
INNER JOIN estado_pedido ep ON p.id_estado_pedido = ep.id_estado_pedido;

CREATE TRIGGER TR_V_Actualizar_Estado_Pedido
INSTEAD OF UPDATE OF id_estado_pedido ON V_Actualizar_Estado_Pedido
BEGIN
    UPDATE pedido
    SET id_estado_pedido = NEW.id_estado_pedido
    WHERE id_pedido = OLD.id_pedido
      AND EXISTS (
        SELECT 1
        FROM estado_pedido ep
        WHERE ep.id_estado_pedido = NEW.id_estado_pedido
      );
END;

CREATE VIEW V_Ventas_Tiendas AS
SELECT
    t.id_tienda,
    t.nombre AS tienda,
    COUNT(CASE WHEN ep.id_estado_pedido IS NOT NULL THEN p.id_pedido END) AS total_pedidos,
    COALESCE(SUM(CASE WHEN ep.id_estado_pedido IS NOT NULL THEN p.total ELSE 0 END), 0) AS ingresos_totales
FROM tienda t
LEFT JOIN pedido p ON t.id_tienda = p.id_tienda
LEFT JOIN estado_pedido ep ON p.id_estado_pedido = ep.id_estado_pedido
    AND ep.nombre IN ('entregado', 'finalizado')
GROUP BY t.id_tienda, t.nombre;

CREATE VIEW V_Comisiones_Repartidores AS
SELECT
    u.id_usuario AS id_repartidor,
    u.nombre || ' ' || u.apellido AS repartidor,
    COUNT(c.id_comision) AS total_comisiones,
    COALESCE(SUM(c.monto), 0) AS monto_total_comisiones
FROM usuario u
LEFT JOIN comision c ON u.id_usuario = c.id_usuario
WHERE u.acepta_repartos = 1
GROUP BY u.id_usuario, u.nombre, u.apellido;

CREATE VIEW V_Usuarios_Permisos AS
SELECT
    u.id_usuario,
    u.nombre || ' ' || u.apellido AS usuario,
    u.correo,
    u.telefono,
    CASE WHEN u.acepta_repartos = 1 THEN 'TRUE' ELSE 'FALSE' END AS acepta_repartos,
    CASE
        WHEN u.rol_sistema = 'admin_plataforma'
          OR EXISTS (
            SELECT 1
            FROM tienda_usuario tu
            WHERE tu.id_usuario = u.id_usuario
              AND tu.cargo = 'administrador'
              AND tu.estado = 1
          )
        THEN 'TRUE'
        ELSE 'FALSE'
    END AS puede_crear_tienda,
    CASE WHEN u.estado = 1 THEN 'TRUE' ELSE 'FALSE' END AS estado
FROM usuario u;

CREATE VIEW V_Productos_Catalogo AS
SELECT
    p.id_producto,
    p.id_tienda,
    p.nombre AS producto,
    p.descripcion,
    p.precio,
    p.stock,
    p.ruta_imagen AS imagen_url,
    t.nombre AS tienda,
    COALESCE(GROUP_CONCAT(c.nombre, ', '), '') AS categorias,
    p.descuento_porcentaje,
    p.descuento_inicio,
    p.descuento_fin,
    CASE WHEN p.estado = 1 THEN 'TRUE' ELSE 'FALSE' END AS estado
FROM producto p
INNER JOIN tienda t ON p.id_tienda = t.id_tienda
LEFT JOIN producto_categoria pc ON p.id_producto = pc.id_producto
LEFT JOIN categoria c ON pc.id_categoria = c.id_categoria
WHERE p.estado = 1
GROUP BY
    p.id_producto,
    p.id_tienda,
    p.nombre,
    p.descripcion,
    p.precio,
    p.stock,
    p.ruta_imagen,
    t.nombre,
    p.descuento_porcentaje,
    p.descuento_inicio,
    p.descuento_fin,
    p.estado;

CREATE VIEW V_Productos_Catalogo_Tienda AS
SELECT
    p.id_producto,
    p.id_tienda,
    p.nombre AS producto,
    p.descripcion,
    p.precio,
    p.stock,
    p.ruta_imagen AS imagen_url,
    t.nombre AS tienda,
    COALESCE(GROUP_CONCAT(c.nombre, ', '), '') AS categorias,
    p.descuento_porcentaje,
    p.descuento_inicio,
    p.descuento_fin,
    CASE WHEN p.estado = 1 THEN 'TRUE' ELSE 'FALSE' END AS estado
FROM producto p
INNER JOIN tienda t ON p.id_tienda = t.id_tienda
LEFT JOIN producto_categoria pc ON p.id_producto = pc.id_producto
LEFT JOIN categoria c ON pc.id_categoria = c.id_categoria
GROUP BY
    p.id_producto,
    p.id_tienda,
    p.nombre,
    p.descripcion,
    p.precio,
    p.stock,
    p.ruta_imagen,
    t.nombre,
    p.descuento_porcentaje,
    p.descuento_inicio,
    p.descuento_fin,
    p.estado;
