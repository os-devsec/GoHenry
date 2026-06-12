package db

import (
	"database/sql"
	"fmt"
)

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
		WHERE id_tienda = @p1
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
		WHERE id_producto = @p1`, idProducto)
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
	var id int64
	err := q.db.QueryRow(`
		INSERT INTO producto
		(id_tienda, nombre, descripcion, precio, stock, descuento_porcentaje, descuento_inicio, descuento_fin, estado)
		OUTPUT INSERTED.id_producto
		VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9)`,
		params.IDTienda,
		params.Nombre,
		params.Descripcion,
		params.Precio,
		params.Stock,
		params.DescuentoPorcentaje,
		params.DescuentoInicio,
		params.DescuentoFin,
		params.Estado,
	).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (q *Queries) UpdateProduct(params UpdateProductParams) error {
	_, err := q.db.Exec(`
		UPDATE producto
		SET nombre = @p1, descripcion = @p2, precio = @p3, stock = @p4, descuento_porcentaje = @p5,
		    descuento_inicio = @p6, descuento_fin = @p7
		WHERE id_producto = @p8`,
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
	_, err := q.db.Exec("UPDATE producto SET estado = @p1 WHERE id_producto = @p2", params.Estado, params.IDProducto)
	return err
}

func (q *Queries) UpdateProductDiscount(params UpdateProductDiscountParams) error {
	_, err := q.db.Exec(`
		UPDATE producto
		SET descuento_porcentaje = @p1, descuento_inicio = @p2, descuento_fin = @p3
		WHERE id_producto = @p4`,
		params.DescuentoPorcentaje,
		params.DescuentoInicio,
		params.DescuentoFin,
		params.IDProducto,
	)
	return err
}

func (q *Queries) UpdateProductImage(params UpdateProductImageParams) error {
	_, err := q.db.Exec("UPDATE producto SET imagen_url = @p1 WHERE id_producto = @p2", params.ImagenURL, params.IDProducto)
	return err
}

func (q *Queries) ProductStore(idProducto any) (int, error) {
	var storeID int
	err := q.db.QueryRow("SELECT id_tienda FROM producto WHERE id_producto = @p1", idProducto).Scan(&storeID)
	return storeID, err
}

func (q *Queries) ListCategories() ([]CategoryRow, error) {
	rows, err := q.db.Query("SELECT id_categoria, nombre, descripcion, CAST(estado AS INT) FROM categoria ORDER BY nombre")
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
	var id int64
	err := q.db.QueryRow(
		"INSERT INTO categoria (nombre, descripcion, estado) OUTPUT INSERTED.id_categoria VALUES (@p1, @p2, 1)",
		nombre,
		descripcion,
	).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (q *Queries) ListProductCategories(idProducto any) ([]CategoryRow, error) {
	rows, err := q.db.Query(`
		SELECT c.id_categoria, c.nombre, c.descripcion, CAST(c.estado AS INT)
		FROM categoria c
		INNER JOIN producto_categoria pc ON pc.id_categoria = c.id_categoria
		WHERE pc.id_producto = @p1
		ORDER BY c.nombre`, idProducto)
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

func (q *Queries) SetProductCategories(idProducto any, categoryIDs []int) error {
	tx, err := q.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM producto_categoria WHERE id_producto = @p1", idProducto); err != nil {
		return err
	}
	seen := map[int]bool{}
	for _, categoryID := range categoryIDs {
		if categoryID <= 0 || seen[categoryID] {
			continue
		}
		seen[categoryID] = true
		var active int
		if err := tx.QueryRow(
			"SELECT CAST(estado AS INT) FROM categoria WHERE id_categoria = @p1",
			categoryID,
		).Scan(&active); err != nil || active != 1 {
			return fmt.Errorf("categoria %d no existe o esta inactiva", categoryID)
		}
		if _, err := tx.Exec(
			"INSERT INTO producto_categoria (id_producto, id_categoria) VALUES (@p1, @p2)",
			idProducto,
			categoryID,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}
