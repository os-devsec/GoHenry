package db

import "database/sql"

type Queries struct {
	db *sql.DB
}

func New(database *sql.DB) *Queries {
	return &Queries{db: database}
}

func (q *Queries) scanProducts(rows *sql.Rows) ([]ProductRow, error) {
	defer rows.Close()
	products := []ProductRow{}
	for rows.Next() {
		var product ProductRow
		if err := rows.Scan(
			&product.IDProducto,
			&product.IDTienda,
			&product.Nombre,
			&product.Descripcion,
			&product.Precio,
			&product.Stock,
			&product.DescuentoPorcentaje,
			&product.DescuentoInicio,
			&product.DescuentoFin,
			&product.ImagenURL,
			&product.Estado,
			&product.Tienda,
			&product.Categorias,
		); err != nil {
			return nil, err
		}
		products = append(products, product)
	}
	return products, rows.Err()
}

func (q *Queries) ListProducts() ([]ProductRow, error) {
	rows, err := q.db.Query(`
		SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
		       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
		       estado, tienda, categorias
		FROM V_Productos_Catalogo
		ORDER BY id_producto`)
	if err != nil {
		return nil, err
	}
	return q.scanProducts(rows)
}

func (q *Queries) ListProductsByStore(idTienda any) ([]ProductRow, error) {
	rows, err := q.db.Query(`
		SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
		       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
		       estado, tienda, categorias
		FROM V_Productos_Catalogo_Tienda
		WHERE id_tienda = ?
		ORDER BY id_producto`, idTienda)
	if err != nil {
		return nil, err
	}
	return q.scanProducts(rows)
}

func (q *Queries) GetProduct(idProducto any) (ProductRow, error) {
	rows, err := q.db.Query(`
		SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
		       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
		       estado, tienda, categorias
		FROM V_Productos_Catalogo_Tienda
		WHERE id_producto = ?`, idProducto)
	if err != nil {
		return ProductRow{}, err
	}
	products, err := q.scanProducts(rows)
	if err != nil {
		return ProductRow{}, err
	}
	if len(products) == 0 {
		return ProductRow{}, sql.ErrNoRows
	}
	return products[0], nil
}

func (q *Queries) CreateProduct(params CreateProductParams) (int64, error) {
	result, err := q.db.Exec(`
		INSERT INTO producto
		(id_tienda, nombre, descripcion, precio, stock, descuento_porcentaje, descuento_inicio, descuento_fin, estado)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		params.IDTienda,
		params.Nombre,
		params.Descripcion,
		params.Precio,
		params.Stock,
		params.DescuentoPorcentaje,
		params.DescuentoInicio,
		params.DescuentoFin,
		params.Estado,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (q *Queries) UpdateProduct(params UpdateProductParams) error {
	_, err := q.db.Exec(`
		UPDATE producto
		SET nombre = ?, descripcion = ?, precio = ?, stock = ?, descuento_porcentaje = ?,
		    descuento_inicio = ?, descuento_fin = ?
		WHERE id_producto = ?`,
		params.Nombre,
		params.Descripcion,
		params.Precio,
		params.Stock,
		params.DescuentoPorcentaje,
		params.DescuentoInicio,
		params.DescuentoFin,
		params.IDProducto,
	)
	return err
}

func (q *Queries) UpdateProductAvailability(params UpdateProductAvailabilityParams) error {
	_, err := q.db.Exec("UPDATE producto SET estado = ? WHERE id_producto = ?", params.Estado, params.IDProducto)
	return err
}

func (q *Queries) UpdateProductDiscount(params UpdateProductDiscountParams) error {
	_, err := q.db.Exec(`
		UPDATE producto
		SET descuento_porcentaje = ?, descuento_inicio = ?, descuento_fin = ?
		WHERE id_producto = ?`,
		params.DescuentoPorcentaje,
		params.DescuentoInicio,
		params.DescuentoFin,
		params.IDProducto,
	)
	return err
}

func (q *Queries) UpdateProductImage(params UpdateProductImageParams) error {
	_, err := q.db.Exec("UPDATE producto SET imagen_url = ? WHERE id_producto = ?", params.ImagenURL, params.IDProducto)
	return err
}

func (q *Queries) ProductStore(idProducto any) (int, error) {
	var storeID int
	err := q.db.QueryRow("SELECT id_tienda FROM producto WHERE id_producto = ?", idProducto).Scan(&storeID)
	return storeID, err
}

func (q *Queries) ListCategories() ([]CategoryRow, error) {
	rows, err := q.db.Query("SELECT id_categoria, nombre, descripcion, estado FROM categoria ORDER BY nombre")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	categories := []CategoryRow{}
	for rows.Next() {
		var category CategoryRow
		if err := rows.Scan(&category.IDCategoria, &category.Nombre, &category.Descripcion, &category.Estado); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	return categories, rows.Err()
}

func (q *Queries) CreateCategory(nombre string, descripcion string) (int64, error) {
	result, err := q.db.Exec("INSERT INTO categoria (nombre, descripcion, estado) VALUES (?, ?, 1)", nombre, descripcion)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (q *Queries) HasStoreRole(storeID int, userID int, roles []string) bool {
	for _, role := range roles {
		var exists int
		err := q.db.QueryRow(`
			SELECT 1
			FROM tienda_usuario
			WHERE id_tienda = ? AND id_usuario = ? AND cargo = ? AND estado = 1`,
			storeID, userID, role,
		).Scan(&exists)
		if err == nil {
			return true
		}
	}
	return false
}
