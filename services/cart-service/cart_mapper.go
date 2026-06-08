package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func writeCart(ctx *gin.Context, id any) {
	ctx.JSON(http.StatusOK, cartMap(id))
}

func cartMap(id any) gin.H {
	cart, _ := queries.GetCart(id)
	rows, _ := queries.ListCartItems(id)
	items := []gin.H{}
	total := 0.0
	for _, row := range rows {
		total += row.Subtotal
		items = append(items, gin.H{
			"id_detalle_carrito": row.IDDetalleCarrito,
			"id_producto":        row.IDProducto,
			"nombre":             row.Nombre,
			"cantidad":           row.Cantidad,
			"precio_unitario":    row.PrecioUnitario,
			"subtotal":           row.Subtotal,
		})
	}
	return gin.H{
		"id_carrito":          cart.IDCarrito,
		"id_usuario":          cart.IDUsuario,
		"id_tienda":           cart.IDTienda,
		"id_estado_carrito":   cart.IDEstadoCarrito,
		"fecha_creacion":      cart.FechaCreacion,
		"fecha_actualizacion": cart.FechaActualizacion,
		"items":               items,
		"total":               total,
	}
}
