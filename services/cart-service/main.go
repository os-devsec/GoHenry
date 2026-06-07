package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "modernc.org/sqlite"
)

type CartPayload struct {
	IDUsuario int `json:"id_usuario"`
	IDTienda  int `json:"id_tienda"`
}

type ItemPayload struct {
	IDProducto int `json:"id_producto"`
	Cantidad   int `json:"cantidad"`
}

type CheckoutPayload struct {
	IDUsuario          int    `json:"id_usuario"`
	IDUbicacionEntrega int    `json:"id_ubicacion_entrega"`
	NombreLugar        string `json:"nombre_lugar"`
	Referencia         string `json:"referencia"`
	TipoPedido         string `json:"tipo_pedido"`
}

var database *sql.DB

func main() {
	var err error
	database, err = sql.Open("sqlite", sqlitePath())
	if err != nil {
		panic(err)
	}
	defer database.Close()

	router := gin.Default()
	router.Use(cors.Default())
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "ok", "service": "cart-service"})
	})

	api := router.Group("/api/v1")
	api.POST("/carritos", createCart)
	api.GET("/carritos/:id", getCart)
	api.POST("/carritos/:id/items", addItem)
	api.PATCH("/carritos/:id/items/:itemId", updateItem)
	api.DELETE("/carritos/:id/items/:itemId", deleteItem)
	api.POST("/carritos/:id/checkout", checkout)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	router.Run("0.0.0.0:" + port)
}

func sqlitePath() string {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return "../../database/integrador.db"
	}
	if strings.HasPrefix(url, "sqlite:///") {
		return strings.TrimPrefix(url, "sqlite:///")
	}
	return url
}

func createCart(ctx *gin.Context) {
	var payload CartPayload
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	user, ok := currentUser(ctx)
	if !ok || (payload.IDUsuario != intFromAny(user["id_usuario"]) && !isPlatformAdmin(user)) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No puedes crear carritos para otro usuario"})
		return
	}
	result, err := database.Exec(`
		INSERT INTO carrito (id_usuario, id_tienda, id_estado_carrito)
		VALUES (?, ?, 1)`, payload.IDUsuario, payload.IDTienda)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	id, _ := result.LastInsertId()
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
	var payload ItemPayload
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if payload.Cantidad <= 0 {
		payload.Cantidad = 1
	}
	var precio float64
	err := database.QueryRow("SELECT precio FROM producto WHERE id_producto = ?", payload.IDProducto).Scan(&precio)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
		return
	}
	subtotal := precio * float64(payload.Cantidad)
	database.Exec(`
		INSERT INTO detalle_carrito (id_carrito, id_producto, cantidad, precio_unitario, subtotal)
		VALUES (?, ?, ?, ?, ?)`, ctx.Param("id"), payload.IDProducto, payload.Cantidad, precio, subtotal)
	writeCart(ctx, ctx.Param("id"))
}

func updateItem(ctx *gin.Context) {
	if !canUseCart(ctx, ctx.Param("id")) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para este carrito"})
		return
	}
	var payload ItemPayload
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if payload.Cantidad <= 0 {
		database.Exec("DELETE FROM detalle_carrito WHERE id_detalle_carrito = ?", ctx.Param("itemId"))
		writeCart(ctx, ctx.Param("id"))
		return
	}
	var precio float64
	database.QueryRow("SELECT precio_unitario FROM detalle_carrito WHERE id_detalle_carrito = ?", ctx.Param("itemId")).Scan(&precio)
	database.Exec("UPDATE detalle_carrito SET cantidad = ?, subtotal = ? WHERE id_detalle_carrito = ?", payload.Cantidad, precio*float64(payload.Cantidad), ctx.Param("itemId"))
	writeCart(ctx, ctx.Param("id"))
}

func deleteItem(ctx *gin.Context) {
	if !canUseCart(ctx, ctx.Param("id")) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para este carrito"})
		return
	}
	database.Exec("DELETE FROM detalle_carrito WHERE id_detalle_carrito = ?", ctx.Param("itemId"))
	writeCart(ctx, ctx.Param("id"))
}

func checkout(ctx *gin.Context) {
	if !canUseCart(ctx, ctx.Param("id")) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para este carrito"})
		return
	}
	var payload CheckoutPayload
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
	database.Exec("UPDATE carrito SET id_estado_carrito = 2, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_carrito = ?", ctx.Param("id"))
	ctx.JSON(response.StatusCode, created)
}

func writeCart(ctx *gin.Context, id any) {
	ctx.JSON(http.StatusOK, cartMap(id))
}

func cartMap(id any) gin.H {
	var cartID, userID, storeID, statusID int
	var created, updated string
	database.QueryRow(`
		SELECT id_carrito, id_usuario, id_tienda, id_estado_carrito, fecha_creacion, fecha_actualizacion
		FROM carrito WHERE id_carrito = ?`, id).Scan(&cartID, &userID, &storeID, &statusID, &created, &updated)
	rows, _ := database.Query(`
		SELECT dc.id_detalle_carrito, dc.id_producto, p.nombre, dc.cantidad, dc.precio_unitario, dc.subtotal
		FROM detalle_carrito dc
		JOIN producto p ON p.id_producto = dc.id_producto
		WHERE dc.id_carrito = ?`, id)
	defer rows.Close()
	items := []gin.H{}
	total := 0.0
	for rows.Next() {
		var itemID, productID, qty int
		var name string
		var price, subtotal float64
		rows.Scan(&itemID, &productID, &name, &qty, &price, &subtotal)
		total += subtotal
		items = append(items, gin.H{
			"id_detalle_carrito": itemID,
			"id_producto":        productID,
			"nombre":             name,
			"cantidad":           qty,
			"precio_unitario":    price,
			"subtotal":           subtotal,
		})
	}
	return gin.H{
		"id_carrito":          cartID,
		"id_usuario":          userID,
		"id_tienda":           storeID,
		"id_estado_carrito":   statusID,
		"fecha_creacion":      created,
		"fecha_actualizacion": updated,
		"items":               items,
		"total":               total,
	}
}

func fallback(value string, alternative string) string {
	if strings.TrimSpace(value) == "" {
		return alternative
	}
	return value
}

func currentUser(ctx *gin.Context) (map[string]any, bool) {
	authorization := ctx.GetHeader("Authorization")
	if authorization == "" {
		return nil, false
	}
	authURL := os.Getenv("AUTH_SERVICE_URL")
	if authURL == "" {
		authURL = "http://auth-service:8000"
	}
	request, err := http.NewRequest(http.MethodGet, authURL+"/api/v1/auth/me", nil)
	if err != nil {
		return nil, false
	}
	request.Header.Set("Authorization", authorization)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, false
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, false
	}
	var user map[string]any
	if err := json.NewDecoder(response.Body).Decode(&user); err != nil {
		return nil, false
	}
	return user, true
}

func canUseCart(ctx *gin.Context, cartID any) bool {
	user, ok := currentUser(ctx)
	if !ok {
		return false
	}
	if isPlatformAdmin(user) {
		return true
	}
	var ownerID int
	err := database.QueryRow("SELECT id_usuario FROM carrito WHERE id_carrito = ?", cartID).Scan(&ownerID)
	return err == nil && ownerID == intFromAny(user["id_usuario"])
}

func isPlatformAdmin(user map[string]any) bool {
	role, _ := user["rol_usuario"].(string)
	return role == "admin_plataforma"
}

func intFromAny(value any) int {
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	case string:
		parsed, _ := strconv.Atoi(typed)
		return parsed
	default:
		return 0
	}
}
