package db

import "database/sql"

type Queries struct {
	db *sql.DB
}

func New(database *sql.DB) *Queries {
	return &Queries{db: database}
}

func (q *Queries) CreateCart(params CreateCartParams) (int64, error) {
	var id int64
	err := q.db.QueryRow(`
		INSERT INTO carrito (id_usuario, id_tienda, id_estado_carrito)
		OUTPUT INSERTED.id_carrito
		VALUES (@p1, @p2, 1)`, params.IDUsuario, params.IDTienda).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (q *Queries) GetCart(id any) (CartRow, error) {
	var cart CartRow
	err := q.db.QueryRow(`
		SELECT id_carrito, id_usuario, id_tienda, id_estado_carrito, fecha_creacion, fecha_actualizacion
		FROM carrito WHERE id_carrito = @p1`, id).Scan(
		&cart.IDCarrito,
		&cart.IDUsuario,
		&cart.IDTienda,
		&cart.IDEstadoCarrito,
		&cart.FechaCreacion,
		&cart.FechaActualizacion,
	)
	return cart, err
}

func (q *Queries) ListCartItems(id any) ([]CartItemRow, error) {
	rows, err := q.db.Query(`
		SELECT dc.id_detalle_carrito, dc.id_producto, p.nombre, dc.cantidad, dc.precio_unitario, dc.subtotal
		FROM detalle_carrito dc
		JOIN producto p ON p.id_producto = dc.id_producto
		WHERE dc.id_carrito = @p1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []CartItemRow{}
	for rows.Next() {
		var item CartItemRow
		if err := rows.Scan(
			&item.IDDetalleCarrito,
			&item.IDProducto,
			&item.Nombre,
			&item.Cantidad,
			&item.PrecioUnitario,
			&item.Subtotal,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (q *Queries) ProductPrice(idProducto int) (float64, error) {
	var price float64
	err := q.db.QueryRow("SELECT precio FROM producto WHERE id_producto = @p1", idProducto).Scan(&price)
	return price, err
}

func (q *Queries) AddCartItem(params AddCartItemParams) error {
	_, err := q.db.Exec(`
		INSERT INTO detalle_carrito (id_carrito, id_producto, cantidad, precio_unitario, subtotal)
		VALUES (@p1, @p2, @p3, @p4, @p5)`,
		params.IDCarrito,
		params.IDProducto,
		params.Cantidad,
		params.PrecioUnitario,
		params.Subtotal,
	)
	return err
}

func (q *Queries) CartItemPrice(idDetalleCarrito any) (float64, error) {
	var price float64
	err := q.db.QueryRow("SELECT precio_unitario FROM detalle_carrito WHERE id_detalle_carrito = @p1", idDetalleCarrito).Scan(&price)
	return price, err
}

func (q *Queries) UpdateCartItem(params UpdateCartItemParams) error {
	_, err := q.db.Exec(
		"UPDATE detalle_carrito SET cantidad = @p1, subtotal = @p2 WHERE id_detalle_carrito = @p3",
		params.Cantidad,
		params.Subtotal,
		params.IDDetalleCarrito,
	)
	return err
}

func (q *Queries) DeleteCartItem(idDetalleCarrito any) error {
	_, err := q.db.Exec("DELETE FROM detalle_carrito WHERE id_detalle_carrito = @p1", idDetalleCarrito)
	return err
}

func (q *Queries) CheckoutCart(idCarrito any) error {
	_, err := q.db.Exec("UPDATE carrito SET id_estado_carrito = 2, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_carrito = @p1", idCarrito)
	return err
}

func (q *Queries) CartOwner(idCarrito any) (int, error) {
	var ownerID int
	err := q.db.QueryRow("SELECT id_usuario FROM carrito WHERE id_carrito = @p1", idCarrito).Scan(&ownerID)
	return ownerID, err
}
