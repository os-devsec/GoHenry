package main

type ProductRequest struct {
	IDTienda            int     `json:"id_tienda"`
	IDCategorias        []int   `json:"id_categorias"`
	Nombre              string  `json:"nombre"`
	Descripcion         string  `json:"descripcion"`
	Precio              float64 `json:"precio"`
	Stock               int     `json:"stock"`
	DescuentoPorcentaje float64 `json:"descuento_porcentaje"`
	DescuentoInicio     string  `json:"descuento_inicio"`
	DescuentoFin        string  `json:"descuento_fin"`
	Estado              *bool   `json:"estado"`
}

type AvailabilityRequest struct {
	Estado bool `json:"estado"`
}

type DiscountRequest struct {
	DescuentoPorcentaje float64 `json:"descuento_porcentaje"`
	DescuentoInicio     string  `json:"descuento_inicio"`
	DescuentoFin        string  `json:"descuento_fin"`
}

type CategoryRequest struct {
	Nombre      string `json:"nombre"`
	Descripcion string `json:"descripcion"`
}
