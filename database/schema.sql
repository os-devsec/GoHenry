PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ubicacion (
  id_ubicacion INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_lugar TEXT NOT NULL,
  referencia TEXT,
  tipo_ubicacion TEXT NOT NULL CHECK (tipo_ubicacion IN ('tienda', 'entrega')),
  estado INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  telefono TEXT,
  password_hash TEXT NOT NULL,
  rol_usuario TEXT NOT NULL DEFAULT 'cliente'
    CHECK (rol_usuario IN ('cliente', 'admin_plataforma')),
  acepta_repartos INTEGER NOT NULL DEFAULT 0,
  estado INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tienda (
  id_tienda INTEGER PRIMARY KEY AUTOINCREMENT,
  id_ubicacion INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  sucursal TEXT,
  logo_url TEXT,
  horario_apertura TEXT NOT NULL,
  horario_cierre TEXT NOT NULL,
  estado INTEGER NOT NULL DEFAULT 1,
  CHECK (horario_cierre > horario_apertura),
  FOREIGN KEY (id_ubicacion) REFERENCES ubicacion(id_ubicacion)
);

CREATE TABLE IF NOT EXISTS tienda_usuario (
  id_tienda_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tienda INTEGER NOT NULL,
  id_usuario INTEGER NOT NULL,
  cargo TEXT NOT NULL,
  estado INTEGER NOT NULL DEFAULT 1,
  UNIQUE (id_tienda, id_usuario),
  FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
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
  precio REAL NOT NULL CHECK (precio >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  imagen_url TEXT,
  descuento_porcentaje REAL NOT NULL DEFAULT 0
    CHECK (descuento_porcentaje BETWEEN 0 AND 100),
  descuento_inicio TEXT,
  descuento_fin TEXT,
  estado INTEGER NOT NULL DEFAULT 1,
  CHECK (
    (descuento_inicio IS NULL AND descuento_fin IS NULL)
    OR (
      descuento_inicio IS NOT NULL
      AND descuento_fin IS NOT NULL
      AND descuento_fin >= descuento_inicio
    )
  ),
  FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda)
);

CREATE TABLE IF NOT EXISTS producto_categoria (
  id_producto_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
  id_producto INTEGER NOT NULL,
  id_categoria INTEGER NOT NULL,
  UNIQUE (id_producto, id_categoria),
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
  CHECK (fecha_actualizacion >= fecha_creacion),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda),
  FOREIGN KEY (id_estado_carrito) REFERENCES estado_carrito(id_estado_carrito)
);

CREATE TABLE IF NOT EXISTS detalle_carrito (
  id_detalle_carrito INTEGER PRIMARY KEY AUTOINCREMENT,
  id_carrito INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  UNIQUE (id_carrito, id_producto),
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
  id_ubicacion_entrega INTEGER NOT NULL,
  fecha_pedido TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo_pedido TEXT NOT NULL CHECK (tipo_pedido IN ('delivery', 'pickup')),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  total_descuento REAL NOT NULL DEFAULT 0 CHECK (total_descuento >= 0),
  total REAL NOT NULL CHECK (total >= 0),
  CHECK (ABS(total - (subtotal - total_descuento)) < 0.001),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda),
  FOREIGN KEY (id_estado_pedido) REFERENCES estado_pedido(id_estado_pedido),
  FOREIGN KEY (id_ubicacion_entrega) REFERENCES ubicacion(id_ubicacion)
);

CREATE TABLE IF NOT EXISTS detalle_pedido (
  id_detalle_pedido INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
  descuento_unitario REAL NOT NULL DEFAULT 0
    CHECK (descuento_unitario >= 0 AND descuento_unitario <= precio_unitario),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  UNIQUE (id_pedido, id_producto),
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
  FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

CREATE TABLE IF NOT EXISTS asignacion_repartidor (
  id_asignacion INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido INTEGER NOT NULL,
  id_usuario INTEGER,
  estado_asignacion TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_asignacion IN ('pendiente', 'aceptada', 'en_camino', 'cancelada', 'entregada')),
  fecha_asignacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_aceptacion TEXT,
  fecha_cancelacion TEXT,
  fecha_entrega TEXT,
  observacion TEXT,
  CHECK (
    (fecha_aceptacion IS NULL OR fecha_aceptacion >= fecha_asignacion)
    AND (fecha_cancelacion IS NULL OR fecha_cancelacion >= fecha_asignacion)
    AND (fecha_entrega IS NULL OR fecha_entrega >= fecha_asignacion)
  ),
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE UNIQUE INDEX IF NOT EXISTS UX_asignacion_repartidor_pedido_activo
ON asignacion_repartidor (id_pedido)
WHERE estado_asignacion IN ('pendiente', 'aceptada', 'en_camino');

CREATE TABLE IF NOT EXISTS metodo_pago (
  id_metodo_pago INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  estado INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pago (
  id_pago INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido INTEGER NOT NULL UNIQUE,
  id_metodo_pago INTEGER NOT NULL,
  monto_total REAL NOT NULL CHECK (monto_total >= 0),
  estado_pago TEXT NOT NULL
    CHECK (estado_pago IN ('pendiente', 'pagado', 'rechazado')),
  fecha_pago TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
  FOREIGN KEY (id_metodo_pago) REFERENCES metodo_pago(id_metodo_pago)
);

CREATE TABLE IF NOT EXISTS comision (
  id_comision INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL,
  id_pedido INTEGER NOT NULL,
  monto REAL NOT NULL CHECK (monto >= 0),
  fecha_comision TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_comision TEXT NOT NULL
    CHECK (estado_comision IN ('pendiente', 'pagada', 'cancelada')),
  UNIQUE (id_usuario, id_pedido),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
);

INSERT OR IGNORE INTO estado_carrito (id_estado_carrito, nombre) VALUES
  (1, 'activo'),
  (2, 'comprado'),
  (3, 'cancelado'),
  (4, 'abandonado'),
  (5, 'enviado');

INSERT OR IGNORE INTO estado_pedido (id_estado_pedido, nombre, descripcion) VALUES
  (1, 'pendiente', 'Pedido creado por el usuario'),
  (2, 'aceptado', 'Pedido aceptado por la tienda'),
  (3, 'en_preparacion', 'La tienda esta preparando el pedido'),
  (4, 'listo_para_entrega', 'Pedido listo para retiro o entrega'),
  (5, 'en_camino', 'El repartidor esta llevando el pedido'),
  (6, 'entregado', 'Pedido entregado correctamente'),
  (7, 'cancelado', 'Pedido cancelado'),
  (8, 'rechazado', 'Pedido rechazado por la tienda');

INSERT OR IGNORE INTO metodo_pago (id_metodo_pago, nombre, estado) VALUES
  (1, 'Efectivo', 1),
  (2, 'Transferencia Banco Pichincha', 1),
  (3, 'Transferencia Banco Guayaquil', 1),
  (4, 'DeUna', 1),
  (5, 'Tarjeta debito/credito', 1);

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
    t.logo_url AS logo_tienda,
    cli.nombre || ' ' || cli.apellido AS cliente,
    cli.telefono AS telefono_cliente,
    u.nombre_lugar AS punto_entrega,
    u.referencia AS referencia_entrega,
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
INNER JOIN ubicacion u ON p.id_ubicacion_entrega = u.id_ubicacion;

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
    t.logo_url AS logo_tienda,
    COUNT(CASE WHEN ep.nombre = 'entregado' THEN p.id_pedido END) AS total_pedidos,
    COALESCE(SUM(CASE WHEN ep.nombre = 'entregado' THEN p.total ELSE 0 END), 0) AS ingresos_totales
FROM tienda t
LEFT JOIN pedido p ON t.id_tienda = p.id_tienda
LEFT JOIN estado_pedido ep ON p.id_estado_pedido = ep.id_estado_pedido
GROUP BY t.id_tienda, t.nombre, t.logo_url;

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
        WHEN u.rol_usuario = 'admin_plataforma'
          OR EXISTS (
            SELECT 1
            FROM tienda_usuario tu
            WHERE tu.id_usuario = u.id_usuario
              AND LOWER(tu.cargo) = 'administrador'
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
    p.nombre AS producto,
    p.descripcion,
    p.precio,
    p.stock,
    p.imagen_url,
    t.id_tienda,
    t.nombre AS tienda,
    t.logo_url AS logo_tienda,
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
    p.nombre,
    p.descripcion,
    p.precio,
    p.stock,
    p.imagen_url,
    t.id_tienda,
    t.nombre,
    t.logo_url,
    p.descuento_porcentaje,
    p.descuento_inicio,
    p.descuento_fin,
    p.estado;

CREATE VIEW V_Productos_Catalogo_Tienda AS
SELECT
    p.id_producto,
    p.nombre AS producto,
    p.descripcion,
    p.precio,
    p.stock,
    p.imagen_url,
    t.id_tienda,
    t.nombre AS tienda,
    t.logo_url AS logo_tienda,
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
    p.nombre,
    p.descripcion,
    p.precio,
    p.stock,
    p.imagen_url,
    t.id_tienda,
    t.nombre,
    t.logo_url,
    p.descuento_porcentaje,
    p.descuento_inicio,
    p.descuento_fin,
    p.estado;
