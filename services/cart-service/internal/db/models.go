package db

type CartRow struct {
	IDCarrito          int
	IDUsuario          int
	IDTienda           int
	IDEstadoCarrito    int
	FechaCreacion      string
	FechaActualizacion string
}

type CartItemRow struct {
	IDDetalleCarrito int
	IDProducto       int
	Nombre           string
	Cantidad         int
	PrecioUnitario   float64
	Subtotal         float64
}

type CreateCartParams struct {
	IDUsuario int
	IDTienda  int
}

type AddCartItemParams struct {
	IDCarrito      any
	IDProducto     int
	Cantidad       int
	PrecioUnitario float64
	Subtotal       float64
}

type UpdateCartItemParams struct {
	Cantidad         int
	Subtotal         float64
	IDDetalleCarrito any
}
