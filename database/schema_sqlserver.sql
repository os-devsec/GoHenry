SET XACT_ABORT ON;
GO

DROP VIEW IF EXISTS V_Productos_Catalogo_Tienda;
DROP VIEW IF EXISTS V_Productos_Catalogo;
DROP VIEW IF EXISTS V_Usuarios_Permisos;
DROP VIEW IF EXISTS V_Comisiones_Repartidores;
DROP VIEW IF EXISTS V_Ventas_Tiendas;
DROP VIEW IF EXISTS V_Actualizar_Estado_Pedido;
DROP VIEW IF EXISTS V_Ordenes_Repartidor;
GO

DROP TABLE IF EXISTS comision;
DROP TABLE IF EXISTS pago;
DROP TABLE IF EXISTS metodo_pago;
DROP TABLE IF EXISTS asignacion_repartidor;
DROP TABLE IF EXISTS detalle_pedido;
DROP TABLE IF EXISTS pedido;
DROP TABLE IF EXISTS estado_pedido;
DROP TABLE IF EXISTS detalle_carrito;
DROP TABLE IF EXISTS carrito;
DROP TABLE IF EXISTS estado_carrito;
DROP TABLE IF EXISTS producto_categoria;
DROP TABLE IF EXISTS producto;
DROP TABLE IF EXISTS categoria;
DROP TABLE IF EXISTS tienda_usuario;
DROP TABLE IF EXISTS tienda;
DROP TABLE IF EXISTS usuario;
DROP TABLE IF EXISTS ubicacion;
GO

CREATE TABLE ubicacion (
  id_ubicacion INT IDENTITY(1,1) PRIMARY KEY,
  nombre_lugar NVARCHAR(120) NOT NULL,
  referencia NVARCHAR(255) NULL,
  tipo_ubicacion NVARCHAR(20) NOT NULL,
  estado BIT NOT NULL CONSTRAINT DF_ubicacion_estado DEFAULT 1,
  CONSTRAINT CK_ubicacion_tipo CHECK (tipo_ubicacion IN ('tienda', 'entrega'))
);

CREATE TABLE usuario (
  id_usuario INT IDENTITY(1,1) PRIMARY KEY,
  nombre NVARCHAR(100) NOT NULL,
  apellido NVARCHAR(100) NOT NULL,
  correo NVARCHAR(255) NOT NULL UNIQUE,
  telefono NVARCHAR(10) NULL,
  password_hash NVARCHAR(80) NOT NULL,
  rol_usuario NVARCHAR(30) NOT NULL CONSTRAINT DF_usuario_rol DEFAULT 'cliente',
  acepta_repartos BIT NOT NULL CONSTRAINT DF_usuario_repartos DEFAULT 0,
  estado BIT NOT NULL CONSTRAINT DF_usuario_estado DEFAULT 1,
  CONSTRAINT CK_usuario_rol CHECK (rol_usuario IN ('cliente', 'admin_plataforma')),
  CONSTRAINT CK_usuario_telefono CHECK (
    telefono IS NULL OR (LEN(telefono) = 10 AND telefono NOT LIKE '%[^0-9]%')
  )
);

CREATE TABLE tienda (
  id_tienda INT IDENTITY(1,1) PRIMARY KEY,
  id_ubicacion INT NOT NULL,
  nombre NVARCHAR(150) NOT NULL,
  sucursal NVARCHAR(150) NULL,
  logo_url NVARCHAR(500) NULL,
  horario_apertura CHAR(5) NOT NULL,
  horario_cierre CHAR(5) NOT NULL,
  estado BIT NOT NULL CONSTRAINT DF_tienda_estado DEFAULT 1,
  CONSTRAINT CK_tienda_horario CHECK (
    TRY_CONVERT(TIME(0), horario_apertura) IS NOT NULL
    AND TRY_CONVERT(TIME(0), horario_cierre) IS NOT NULL
    AND TRY_CONVERT(TIME(0), horario_cierre) > TRY_CONVERT(TIME(0), horario_apertura)
  ),
  CONSTRAINT FK_tienda_ubicacion FOREIGN KEY (id_ubicacion) REFERENCES ubicacion(id_ubicacion)
);

CREATE TABLE tienda_usuario (
  id_tienda_usuario INT IDENTITY(1,1) PRIMARY KEY,
  id_tienda INT NOT NULL,
  id_usuario INT NOT NULL,
  cargo NVARCHAR(40) NOT NULL,
  estado BIT NOT NULL CONSTRAINT DF_tienda_usuario_estado DEFAULT 1,
  CONSTRAINT UQ_tienda_usuario UNIQUE (id_tienda, id_usuario),
  CONSTRAINT FK_tienda_usuario_tienda FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda),
  CONSTRAINT FK_tienda_usuario_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE TABLE categoria (
  id_categoria INT IDENTITY(1,1) PRIMARY KEY,
  nombre NVARCHAR(120) NOT NULL UNIQUE,
  descripcion NVARCHAR(500) NOT NULL CONSTRAINT DF_categoria_descripcion DEFAULT '',
  estado BIT NOT NULL CONSTRAINT DF_categoria_estado DEFAULT 1
);

CREATE TABLE producto (
  id_producto INT IDENTITY(1,1) PRIMARY KEY,
  id_tienda INT NOT NULL,
  nombre NVARCHAR(150) NOT NULL,
  descripcion NVARCHAR(1000) NULL,
  precio DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL CONSTRAINT DF_producto_stock DEFAULT 0,
  imagen_url NVARCHAR(500) NULL,
  descuento_porcentaje DECIMAL(5,2) NOT NULL CONSTRAINT DF_producto_descuento DEFAULT 0,
  descuento_inicio CHAR(5) NULL,
  descuento_fin CHAR(5) NULL,
  estado BIT NOT NULL CONSTRAINT DF_producto_estado DEFAULT 1,
  CONSTRAINT CK_producto_precio CHECK (precio >= 0),
  CONSTRAINT CK_producto_stock CHECK (stock >= 0),
  CONSTRAINT CK_producto_descuento CHECK (descuento_porcentaje BETWEEN 0 AND 100),
  CONSTRAINT CK_producto_horario_descuento CHECK (
    (descuento_inicio IS NULL AND descuento_fin IS NULL)
    OR (
      descuento_inicio IS NOT NULL
      AND descuento_fin IS NOT NULL
      AND TRY_CONVERT(TIME(0), descuento_inicio) IS NOT NULL
      AND TRY_CONVERT(TIME(0), descuento_fin) IS NOT NULL
      AND TRY_CONVERT(TIME(0), descuento_fin) > TRY_CONVERT(TIME(0), descuento_inicio)
    )
  ),
  CONSTRAINT FK_producto_tienda FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda)
);

CREATE TABLE producto_categoria (
  id_producto_categoria INT IDENTITY(1,1) PRIMARY KEY,
  id_producto INT NOT NULL,
  id_categoria INT NOT NULL,
  CONSTRAINT UQ_producto_categoria UNIQUE (id_producto, id_categoria),
  CONSTRAINT FK_producto_categoria_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
  CONSTRAINT FK_producto_categoria_categoria FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
);

CREATE TABLE estado_carrito (
  id_estado_carrito INT IDENTITY(1,1) PRIMARY KEY,
  nombre NVARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE carrito (
  id_carrito INT IDENTITY(1,1) PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_tienda INT NOT NULL,
  id_estado_carrito INT NOT NULL,
  fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_carrito_creacion DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME2(0) NOT NULL CONSTRAINT DF_carrito_actualizacion DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT CK_carrito_fechas CHECK (fecha_actualizacion >= fecha_creacion),
  CONSTRAINT FK_carrito_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  CONSTRAINT FK_carrito_tienda FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda),
  CONSTRAINT FK_carrito_estado FOREIGN KEY (id_estado_carrito) REFERENCES estado_carrito(id_estado_carrito)
);

CREATE TABLE detalle_carrito (
  id_detalle_carrito INT IDENTITY(1,1) PRIMARY KEY,
  id_carrito INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  CONSTRAINT CK_detalle_carrito_cantidad CHECK (cantidad > 0),
  CONSTRAINT CK_detalle_carrito_precio CHECK (precio_unitario >= 0),
  CONSTRAINT CK_detalle_carrito_subtotal CHECK (subtotal >= 0),
  CONSTRAINT UQ_detalle_carrito UNIQUE (id_carrito, id_producto),
  CONSTRAINT FK_detalle_carrito_carrito FOREIGN KEY (id_carrito) REFERENCES carrito(id_carrito),
  CONSTRAINT FK_detalle_carrito_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

CREATE TABLE estado_pedido (
  id_estado_pedido INT IDENTITY(1,1) PRIMARY KEY,
  nombre NVARCHAR(50) NOT NULL UNIQUE,
  descripcion NVARCHAR(255) NULL
);

CREATE TABLE pedido (
  id_pedido INT IDENTITY(1,1) PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_tienda INT NOT NULL,
  id_estado_pedido INT NOT NULL,
  id_ubicacion_entrega INT NOT NULL,
  fecha_pedido DATETIME2(0) NOT NULL CONSTRAINT DF_pedido_fecha DEFAULT CURRENT_TIMESTAMP,
  tipo_pedido NVARCHAR(20) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  total_descuento DECIMAL(10,2) NOT NULL CONSTRAINT DF_pedido_descuento DEFAULT 0,
  costo_envio DECIMAL(10,2) NOT NULL CONSTRAINT DF_pedido_envio DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  CONSTRAINT CK_pedido_tipo CHECK (tipo_pedido IN ('delivery', 'pickup')),
  CONSTRAINT CK_pedido_subtotal CHECK (subtotal >= 0),
  CONSTRAINT CK_pedido_descuento CHECK (total_descuento >= 0),
  CONSTRAINT CK_pedido_envio CHECK (costo_envio >= 0),
  CONSTRAINT CK_pedido_total CHECK (total >= 0 AND total = subtotal - total_descuento),
  CONSTRAINT FK_pedido_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  CONSTRAINT FK_pedido_tienda FOREIGN KEY (id_tienda) REFERENCES tienda(id_tienda),
  CONSTRAINT FK_pedido_estado FOREIGN KEY (id_estado_pedido) REFERENCES estado_pedido(id_estado_pedido),
  CONSTRAINT FK_pedido_ubicacion FOREIGN KEY (id_ubicacion_entrega) REFERENCES ubicacion(id_ubicacion)
);

CREATE TABLE detalle_pedido (
  id_detalle_pedido INT IDENTITY(1,1) PRIMARY KEY,
  id_pedido INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  descuento_unitario DECIMAL(10,2) NOT NULL CONSTRAINT DF_detalle_pedido_descuento DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL,
  CONSTRAINT CK_detalle_pedido_cantidad CHECK (cantidad > 0),
  CONSTRAINT CK_detalle_pedido_precio CHECK (precio_unitario >= 0),
  CONSTRAINT CK_detalle_pedido_descuento CHECK (
    descuento_unitario >= 0 AND descuento_unitario <= precio_unitario
  ),
  CONSTRAINT CK_detalle_pedido_subtotal CHECK (subtotal >= 0),
  CONSTRAINT UQ_detalle_pedido UNIQUE (id_pedido, id_producto),
  CONSTRAINT FK_detalle_pedido_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
  CONSTRAINT FK_detalle_pedido_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

CREATE TABLE asignacion_repartidor (
  id_asignacion INT IDENTITY(1,1) PRIMARY KEY,
  id_pedido INT NOT NULL,
  id_usuario INT NULL,
  estado_asignacion NVARCHAR(20) NOT NULL CONSTRAINT DF_asignacion_estado DEFAULT 'pendiente',
  fecha_asignacion DATETIME2(0) NOT NULL CONSTRAINT DF_asignacion_fecha DEFAULT CURRENT_TIMESTAMP,
  fecha_aceptacion DATETIME2(0) NULL,
  fecha_cancelacion DATETIME2(0) NULL,
  fecha_entrega DATETIME2(0) NULL,
  observacion NVARCHAR(500) NULL,
  CONSTRAINT CK_asignacion_estado CHECK (
    estado_asignacion IN ('pendiente', 'aceptada', 'en_camino', 'cancelada', 'entregada')
  ),
  CONSTRAINT CK_asignacion_fechas CHECK (
    (fecha_aceptacion IS NULL OR fecha_aceptacion >= fecha_asignacion)
    AND (fecha_cancelacion IS NULL OR fecha_cancelacion >= fecha_asignacion)
    AND (fecha_entrega IS NULL OR fecha_entrega >= fecha_asignacion)
  ),
  CONSTRAINT FK_asignacion_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
  CONSTRAINT FK_asignacion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE UNIQUE INDEX UX_asignacion_repartidor_pedido_activo
ON asignacion_repartidor (id_pedido)
WHERE estado_asignacion IN ('pendiente', 'aceptada', 'en_camino');

CREATE TABLE metodo_pago (
  id_metodo_pago INT IDENTITY(1,1) PRIMARY KEY,
  nombre NVARCHAR(80) NOT NULL UNIQUE,
  estado BIT NOT NULL CONSTRAINT DF_metodo_pago_estado DEFAULT 1
);

CREATE TABLE pago (
  id_pago INT IDENTITY(1,1) PRIMARY KEY,
  id_pedido INT NOT NULL UNIQUE,
  id_metodo_pago INT NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  estado_pago NVARCHAR(20) NOT NULL,
  fecha_pago DATETIME2(0) NOT NULL CONSTRAINT DF_pago_fecha DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT CK_pago_monto CHECK (monto_total >= 0),
  CONSTRAINT CK_pago_estado CHECK (estado_pago IN ('pendiente', 'pagado', 'rechazado')),
  CONSTRAINT FK_pago_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
  CONSTRAINT FK_pago_metodo FOREIGN KEY (id_metodo_pago) REFERENCES metodo_pago(id_metodo_pago)
);

CREATE TABLE comision (
  id_comision INT IDENTITY(1,1) PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_pedido INT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha_comision DATETIME2(0) NOT NULL CONSTRAINT DF_comision_fecha DEFAULT CURRENT_TIMESTAMP,
  estado_comision NVARCHAR(20) NOT NULL,
  CONSTRAINT CK_comision_monto CHECK (monto >= 0),
  CONSTRAINT CK_comision_estado CHECK (estado_comision IN ('pendiente', 'pagada', 'cancelada')),
  CONSTRAINT UQ_comision_usuario_pedido UNIQUE (id_usuario, id_pedido),
  CONSTRAINT FK_comision_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  CONSTRAINT FK_comision_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
);
GO

SET IDENTITY_INSERT estado_carrito ON;
INSERT INTO estado_carrito (id_estado_carrito, nombre) VALUES
  (1, 'activo'),
  (2, 'comprado'),
  (3, 'cancelado'),
  (4, 'abandonado'),
  (5, 'enviado');
SET IDENTITY_INSERT estado_carrito OFF;

SET IDENTITY_INSERT estado_pedido ON;
INSERT INTO estado_pedido (id_estado_pedido, nombre, descripcion) VALUES
  (1, 'pendiente', 'Pedido creado por el usuario'),
  (2, 'aceptado', 'Pedido aceptado por la tienda'),
  (3, 'en_preparacion', 'La tienda esta preparando el pedido'),
  (4, 'listo_para_entrega', 'Pedido listo para retiro o entrega'),
  (5, 'en_camino', 'El repartidor esta llevando el pedido'),
  (6, 'entregado', 'Pedido entregado correctamente'),
  (7, 'cancelado', 'Pedido cancelado'),
  (8, 'rechazado', 'Pedido rechazado por la tienda');
SET IDENTITY_INSERT estado_pedido OFF;

SET IDENTITY_INSERT metodo_pago ON;
INSERT INTO metodo_pago (id_metodo_pago, nombre, estado) VALUES
  (1, 'Efectivo', 1),
  (2, 'Transferencia', 1),
  (3, 'DeUna', 1);
SET IDENTITY_INSERT metodo_pago OFF;

INSERT INTO categoria (nombre, descripcion, estado)
VALUES ('Extra', 'Productos que se ofrecen como opciones adicionales', 1);

INSERT INTO ubicacion (nombre_lugar, referencia, tipo_ubicacion, estado) VALUES
  ('Deportes', 'Campus UIDE', 'entrega', 1),
  ('Automotriz', 'Campus UIDE', 'entrega', 1),
  ('Gastronomia', 'Campus UIDE', 'entrega', 1);
GO

CREATE VIEW V_Ordenes_Repartidor AS
SELECT
  ar.id_asignacion,
  p.id_pedido,
  ar.id_usuario AS id_repartidor,
  CASE
    WHEN rep.id_usuario IS NULL THEN NULL
    ELSE CONCAT(rep.nombre, ' ', rep.apellido)
  END AS repartidor,
  rep.telefono AS telefono_repartidor,
  ar.estado_asignacion,
  p.tipo_pedido,
  p.fecha_pedido,
  t.nombre AS tienda,
  t.logo_url AS logo_tienda,
  CONCAT(cli.nombre, ' ', cli.apellido) AS cliente,
  cli.telefono AS telefono_cliente,
  u.nombre_lugar AS punto_entrega,
  u.referencia AS referencia_entrega,
  p.subtotal,
  p.total_descuento,
  p.costo_envio,
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
GO

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
  p.costo_envio,
  p.total
FROM pedido p
INNER JOIN estado_pedido ep ON p.id_estado_pedido = ep.id_estado_pedido;
GO

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
GO

CREATE VIEW V_Comisiones_Repartidores AS
SELECT
  u.id_usuario AS id_repartidor,
  CONCAT(u.nombre, ' ', u.apellido) AS repartidor,
  COUNT(c.id_comision) AS total_comisiones,
  COALESCE(SUM(c.monto), 0) AS monto_total_comisiones
FROM usuario u
LEFT JOIN comision c ON u.id_usuario = c.id_usuario
WHERE u.acepta_repartos = 1
GROUP BY u.id_usuario, u.nombre, u.apellido;
GO

CREATE VIEW V_Usuarios_Permisos AS
SELECT
  u.id_usuario,
  CONCAT(u.nombre, ' ', u.apellido) AS usuario,
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
GO

CREATE VIEW V_Productos_Catalogo AS
SELECT
  p.id_producto,
  p.nombre AS producto,
  COALESCE(p.descripcion, '') AS descripcion,
  p.precio,
  p.stock,
  p.imagen_url,
  t.id_tienda,
  t.nombre AS tienda,
  t.logo_url AS logo_tienda,
  COALESCE(STRING_AGG(CAST(c.nombre AS NVARCHAR(MAX)), ', '), '') AS categorias,
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
  p.id_producto, p.nombre, p.descripcion, p.precio, p.stock, p.imagen_url,
  t.id_tienda, t.nombre, t.logo_url, p.descuento_porcentaje,
  p.descuento_inicio, p.descuento_fin, p.estado;
GO

CREATE VIEW V_Productos_Catalogo_Tienda AS
SELECT
  p.id_producto,
  p.nombre AS producto,
  COALESCE(p.descripcion, '') AS descripcion,
  p.precio,
  p.stock,
  p.imagen_url,
  t.id_tienda,
  t.nombre AS tienda,
  t.logo_url AS logo_tienda,
  COALESCE(STRING_AGG(CAST(c.nombre AS NVARCHAR(MAX)), ', '), '') AS categorias,
  p.descuento_porcentaje,
  p.descuento_inicio,
  p.descuento_fin,
  CASE WHEN p.estado = 1 THEN 'TRUE' ELSE 'FALSE' END AS estado
FROM producto p
INNER JOIN tienda t ON p.id_tienda = t.id_tienda
LEFT JOIN producto_categoria pc ON p.id_producto = pc.id_producto
LEFT JOIN categoria c ON pc.id_categoria = c.id_categoria
GROUP BY
  p.id_producto, p.nombre, p.descripcion, p.precio, p.stock, p.imagen_url,
  t.id_tienda, t.nombre, t.logo_url, p.descuento_porcentaje,
  p.descuento_inicio, p.descuento_fin, p.estado;
GO
