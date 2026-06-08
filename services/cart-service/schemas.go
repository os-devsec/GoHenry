package main

type CartRequest struct {
	IDUsuario int `json:"id_usuario"`
	IDTienda  int `json:"id_tienda"`
}

type ItemRequest struct {
	IDProducto int `json:"id_producto"`
	Cantidad   int `json:"cantidad"`
}

type CheckoutRequest struct {
	IDUsuario          int    `json:"id_usuario"`
	IDUbicacionEntrega int    `json:"id_ubicacion_entrega"`
	NombreLugar        string `json:"nombre_lugar"`
	Referencia         string `json:"referencia"`
	TipoPedido         string `json:"tipo_pedido"`
}
