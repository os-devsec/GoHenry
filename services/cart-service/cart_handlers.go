package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"

	cartdb "integrador/cart-service/internal/db"

	"github.com/gin-gonic/gin"
)

func createCart(ctx *gin.Context) {
	var payload CartRequest
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	user, ok := currentUser(ctx)
	if !ok || (payload.IDUsuario != intFromAny(user["id_usuario"]) && !isPlatformAdmin(user)) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No puedes crear carritos para otro usuario"})
		return
	}
	id, err := queries.CreateCart(cartdb.CreateCartParams{IDUsuario: payload.IDUsuario, IDTienda: payload.IDTienda})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeCart(ctx, id)
}

func getCart(ctx *gin.Context) {
	if !canUseCart(ctx, ctx.Param("id")) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para este carrito"})
		return
	}
	writeCart(ctx, ctx.Param("id"))
}

func addItem(ctx *gin.Context) {
	if !canUseCart(ctx, ctx.Param("id")) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para este carrito"})
		return
	}
	var payload ItemRequest
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if payload.Cantidad <= 0 {
		payload.Cantidad = 1
	}
	precio, err := queries.ProductPrice(payload.IDProducto)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
		return
	}
	subtotal := precio * float64(payload.Cantidad)
	queries.AddCartItem(cartdb.AddCartItemParams{
		IDCarrito:      ctx.Param("id"),
		IDProducto:     payload.IDProducto,
		Cantidad:       payload.Cantidad,
		PrecioUnitario: precio,
		Subtotal:       subtotal,
	})
	writeCart(ctx, ctx.Param("id"))
}

func updateItem(ctx *gin.Context) {
	if !canUseCart(ctx, ctx.Param("id")) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para este carrito"})
		return
	}
	var payload ItemRequest
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if payload.Cantidad <= 0 {
		queries.DeleteCartItem(ctx.Param("itemId"))
		writeCart(ctx, ctx.Param("id"))
		return
	}
	precio, _ := queries.CartItemPrice(ctx.Param("itemId"))
	queries.UpdateCartItem(cartdb.UpdateCartItemParams{
		Cantidad:         payload.Cantidad,
		Subtotal:         precio * float64(payload.Cantidad),
		IDDetalleCarrito: ctx.Param("itemId"),
	})
	writeCart(ctx, ctx.Param("id"))
}

func deleteItem(ctx *gin.Context) {
	if !canUseCart(ctx, ctx.Param("id")) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para este carrito"})
		return
	}
	queries.DeleteCartItem(ctx.Param("itemId"))
	writeCart(ctx, ctx.Param("id"))
}

func checkout(ctx *gin.Context) {
	if !canUseCart(ctx, ctx.Param("id")) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para este carrito"})
		return
	}
	var payload CheckoutRequest
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	cart := cartMap(ctx.Param("id"))
	body := gin.H{
		"id_usuario":           payload.IDUsuario,
		"id_tienda":            cart["id_tienda"],
		"tipo_pedido":          fallback(payload.TipoPedido, "delivery"),
		"id_ubicacion_entrega": payload.IDUbicacionEntrega,
		"nombre_lugar":         payload.NombreLugar,
		"referencia":           payload.Referencia,
		"items":                cart["items"],
	}
	encoded, _ := json.Marshal(body)
	ordersURL := os.Getenv("ORDERS_SERVICE_URL")
	if ordersURL == "" {
		ordersURL = "http://orders-service:8000"
	}
	request, err := http.NewRequest(http.MethodPost, ordersURL+"/api/v1/pedidos", bytes.NewReader(encoded))
	if err != nil {
		ctx.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", ctx.GetHeader("Authorization"))
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}
	defer response.Body.Close()
	var created map[string]any
	json.NewDecoder(response.Body).Decode(&created)
	queries.CheckoutCart(ctx.Param("id"))
	ctx.JSON(response.StatusCode, created)
}
