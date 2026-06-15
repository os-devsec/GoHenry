package db

import "database/sql"

type ProductRow struct {
	IDProducto          int
	IDTienda            int
	Nombre              string
	Descripcion         string
	Precio              float64
	Stock               int
	DescuentoPorcentaje float64
	DescuentoInicio     sql.NullString
	DescuentoFin        sql.NullString
	ImagenURL           sql.NullString
	Estado              string
	Tienda              string
	Categorias          string
}

type CategoryRow struct {
	IDCategoria int
	Nombre      string
	Descripcion string
	Estado      int
}

type CreateProductParams struct {
	IDTienda            int
	Nombre              string
	Descripcion         string
	Precio              float64
	Stock               int
	DescuentoPorcentaje float64
	DescuentoInicio     any
	DescuentoFin        any
	ImagenURL           any
	Estado              int
}

type UpdateProductParams struct {
	Nombre              string
	Descripcion         string
	Precio              float64
	Stock               int
	DescuentoPorcentaje float64
	DescuentoInicio     any
	DescuentoFin        any
	ImagenURL           any
	Estado              int
	IDProducto          any
}

type UpdateProductAvailabilityParams struct {
	Estado     int
	IDProducto any
}

type UpdateProductDiscountParams struct {
	DescuentoPorcentaje float64
	DescuentoInicio     any
	DescuentoFin        any
	IDProducto          any
}
