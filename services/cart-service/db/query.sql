-- name: CreateCart :execlastid
INSERT INTO carrito (id_usuario, id_tienda, id_estado_carrito)
VALUES (?, ?, 1);

-- name: GetCart :one
SELECT id_carrito, id_usuario, id_tienda, id_estado_carrito, fecha_creacion, fecha_actualizacion
FROM carrito WHERE id_carrito = ?;

-- name: ListCartItems :many
SELECT dc.id_detalle_carrito, dc.id_producto, p.nombre, dc.cantidad, dc.precio_unitario, dc.subtotal
FROM detalle_carrito dc
JOIN producto p ON p.id_producto = dc.id_producto
WHERE dc.id_carrito = ?;

-- name: ProductPrice :one
SELECT precio FROM producto WHERE id_producto = ?;

-- name: AddCartItem :exec
INSERT INTO detalle_carrito (id_carrito, id_producto, cantidad, precio_unitario, subtotal)
VALUES (?, ?, ?, ?, ?);

-- name: CartItemPrice :one
SELECT precio_unitario FROM detalle_carrito WHERE id_detalle_carrito = ?;

-- name: UpdateCartItem :exec
UPDATE detalle_carrito SET cantidad = ?, subtotal = ? WHERE id_detalle_carrito = ?;

-- name: DeleteCartItem :exec
DELETE FROM detalle_carrito WHERE id_detalle_carrito = ?;

-- name: CheckoutCart :exec
UPDATE carrito SET id_estado_carrito = 2, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_carrito = ?;

-- name: CartOwner :one
SELECT id_usuario FROM carrito WHERE id_carrito = ?;
