-- name: ListProducts :many
SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
       estado, tienda, categorias
FROM V_Productos_Catalogo
ORDER BY id_producto;

-- name: ListProductsByStore :many
SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
       estado, tienda, categorias
FROM V_Productos_Catalogo_Tienda
WHERE id_tienda = ?
ORDER BY id_producto;

-- name: GetProduct :one
SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
       estado, tienda, categorias
FROM V_Productos_Catalogo_Tienda
WHERE id_producto = ?;

-- name: CreateProduct :execlastid
INSERT INTO producto
(id_tienda, nombre, descripcion, precio, stock, descuento_porcentaje, descuento_inicio, descuento_fin, estado)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateProduct :exec
UPDATE producto
SET nombre = ?, descripcion = ?, precio = ?, stock = ?, descuento_porcentaje = ?,
    descuento_inicio = ?, descuento_fin = ?
WHERE id_producto = ?;

-- name: UpdateProductAvailability :exec
UPDATE producto SET estado = ? WHERE id_producto = ?;

-- name: UpdateProductDiscount :exec
UPDATE producto
SET descuento_porcentaje = ?, descuento_inicio = ?, descuento_fin = ?
WHERE id_producto = ?;

-- name: UpdateProductImage :exec
UPDATE producto SET imagen_url = ? WHERE id_producto = ?;

-- name: ProductStore :one
SELECT id_tienda FROM producto WHERE id_producto = ?;

-- name: ListCategories :many
SELECT id_categoria, nombre, descripcion, estado FROM categoria ORDER BY nombre;

-- name: CreateCategory :execlastid
INSERT INTO categoria (nombre, descripcion, estado) VALUES (?, ?, 1);

-- name: HasStoreRole :one
SELECT 1
FROM tienda_usuario
WHERE id_tienda = ? AND id_usuario = ? AND cargo IN (sqlc.slice('roles')) AND estado = 1;
