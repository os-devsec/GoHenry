package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "modernc.org/sqlite"
)

type ProductPayload struct {
	IDTienda            int     `json:"id_tienda"`
	Nombre              string  `json:"nombre"`
	Descripcion         string  `json:"descripcion"`
	Precio              float64 `json:"precio"`
	Stock               int     `json:"stock"`
	DescuentoPorcentaje float64 `json:"descuento_porcentaje"`
	DescuentoInicio     string  `json:"descuento_inicio"`
	DescuentoFin        string  `json:"descuento_fin"`
	Estado              *bool   `json:"estado"`
}

type AvailabilityPayload struct {
	Estado bool `json:"estado"`
}

type DiscountPayload struct {
	DescuentoPorcentaje float64 `json:"descuento_porcentaje"`
	DescuentoInicio     string  `json:"descuento_inicio"`
	DescuentoFin        string  `json:"descuento_fin"`
}

type CategoryPayload struct {
	Nombre      string `json:"nombre"`
	Descripcion string `json:"descripcion"`
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
	router.Static("/api/v1/productos/imagenes", uploadDir())
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "ok", "service": "catalog-service"})
	})

	api := router.Group("/api/v1")
	api.GET("/productos", listProducts)
	api.POST("/productos", createProduct)
	api.GET("/productos/:id", getProduct)
	api.PATCH("/productos/:id", updateProduct)
	api.DELETE("/productos/:id", deleteProduct)
	api.PATCH("/productos/:id/disponibilidad", updateAvailability)
	api.PATCH("/productos/:id/descuento", updateDiscount)
	api.POST("/productos/:id/imagen", uploadProductImage)
	api.GET("/categorias", listCategories)
	api.POST("/categorias", createCategory)
	api.GET("/tiendas/:id/productos", listProductsByStore)

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

func uploadDir() string {
	dir := os.Getenv("UPLOAD_DIR")
	if dir == "" {
		dir = "uploads/products"
	}
	os.MkdirAll(dir, 0755)
	return dir
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func productRows(query string, args ...any) ([]gin.H, error) {
	rows, err := database.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := []gin.H{}
	for rows.Next() {
		var id, storeID, stock int
		var nombre, descripcion, tienda string
		var precio, descuento float64
		var inicio, fin, imagen sql.NullString
		var estado, categorias string
		if err := rows.Scan(&id, &storeID, &nombre, &descripcion, &precio, &stock, &descuento, &inicio, &fin, &imagen, &estado, &tienda, &categorias); err != nil {
			return nil, err
		}
		products = append(products, gin.H{
			"id_producto":          id,
			"id_tienda":            storeID,
			"nombre":               nombre,
			"descripcion":          descripcion,
			"precio":               precio,
			"stock":                stock,
			"descuento_porcentaje": descuento,
			"descuento_inicio":     inicio.String,
			"descuento_fin":        fin.String,
			"ruta_imagen":          imagen.String,
			"estado":               strings.EqualFold(estado, "TRUE"),
			"tienda_nombre":        tienda,
			"categorias":           categorias,
		})
	}
	return products, nil
}

func listProducts(ctx *gin.Context) {
	store := ctx.Query("tienda")
	query := `
		SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
		       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
		       estado, tienda, categorias
		FROM V_Productos_Catalogo
		WHERE 1=1`
	args := []any{}
	if store != "" {
		query += " AND id_tienda = ?"
		args = append(args, store)
	}
	query += " ORDER BY id_producto"
	products, err := productRows(query, args...)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, products)
}

func listProductsByStore(ctx *gin.Context) {
	products, err := productRows(`
		SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
		       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
		       estado, tienda, categorias
		FROM V_Productos_Catalogo_Tienda
		WHERE id_tienda = ?
		ORDER BY id_producto`, ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, products)
}

func getProduct(ctx *gin.Context) {
	products, err := productRows(`
		SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
		       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
		       estado, tienda, categorias
		FROM V_Productos_Catalogo_Tienda
		WHERE id_producto = ?`, ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if len(products) == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
		return
	}
	ctx.JSON(http.StatusOK, products[0])
}

func createProduct(ctx *gin.Context) {
	var payload ProductPayload
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	user, ok := currentUser(ctx)
	if !ok || !hasStoreRole(payload.IDTienda, user, []string{"administrador"}) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "Solo administradores de tienda pueden crear productos"})
		return
	}
	if payload.DescuentoPorcentaje < 0 || payload.DescuentoPorcentaje > 100 {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": "El descuento debe ser un porcentaje entre 0 y 100"})
		return
	}
	estado := true
	if payload.Estado != nil {
		estado = *payload.Estado
	}
	result, err := database.Exec(`
		INSERT INTO producto
		(id_tienda, nombre, descripcion, precio, stock, descuento_porcentaje, descuento_inicio, descuento_fin, estado)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		payload.IDTienda, payload.Nombre, payload.Descripcion, payload.Precio, payload.Stock,
		payload.DescuentoPorcentaje, nullString(payload.DescuentoInicio), nullString(payload.DescuentoFin), boolInt(estado))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	id, _ := result.LastInsertId()
	products, err := productRows(`
		SELECT id_producto, id_tienda, producto, descripcion, precio, stock,
		       descuento_porcentaje, descuento_inicio, descuento_fin, imagen_url,
		       estado, tienda, categorias
		FROM V_Productos_Catalogo_Tienda
		WHERE id_producto = ?`, id)
	if err != nil || len(products) == 0 {
		ctx.JSON(http.StatusCreated, gin.H{"id_producto": id})
		return
	}
	ctx.JSON(http.StatusCreated, products[0])
}

func updateProduct(ctx *gin.Context) {
	var payload ProductPayload
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	storeID, ok := productStore(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
		return
	}
	user, authenticated := currentUser(ctx)
	if !authenticated || !hasStoreRole(storeID, user, []string{"administrador"}) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para modificar este producto"})
		return
	}
	if payload.DescuentoPorcentaje < 0 || payload.DescuentoPorcentaje > 100 {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": "El descuento debe ser un porcentaje entre 0 y 100"})
		return
	}
	_, err := database.Exec(`
		UPDATE producto
		SET nombre = ?, descripcion = ?, precio = ?, stock = ?, descuento_porcentaje = ?,
		    descuento_inicio = ?, descuento_fin = ?
		WHERE id_producto = ?`,
		payload.Nombre, payload.Descripcion, payload.Precio, payload.Stock, payload.DescuentoPorcentaje,
		nullString(payload.DescuentoInicio), nullString(payload.DescuentoFin), ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	getProduct(ctx)
}

func deleteProduct(ctx *gin.Context) {
	storeID, ok := productStore(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
		return
	}
	user, authenticated := currentUser(ctx)
	if !authenticated || !hasStoreRole(storeID, user, []string{"administrador"}) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para modificar este producto"})
		return
	}
	database.Exec("UPDATE producto SET estado = 0 WHERE id_producto = ?", ctx.Param("id"))
	ctx.JSON(http.StatusOK, gin.H{"ok": true})
}

func updateAvailability(ctx *gin.Context) {
	var payload AvailabilityPayload
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	storeID, ok := productStore(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
		return
	}
	user, authenticated := currentUser(ctx)
	if !authenticated || !hasStoreRole(storeID, user, []string{"administrador"}) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para modificar este producto"})
		return
	}
	database.Exec("UPDATE producto SET estado = ? WHERE id_producto = ?", boolInt(payload.Estado), ctx.Param("id"))
	getProduct(ctx)
}

func updateDiscount(ctx *gin.Context) {
	var payload DiscountPayload
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	storeID, ok := productStore(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
		return
	}
	user, authenticated := currentUser(ctx)
	if !authenticated || !hasStoreRole(storeID, user, []string{"administrador"}) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para modificar este producto"})
		return
	}
	if payload.DescuentoPorcentaje < 0 || payload.DescuentoPorcentaje > 100 {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": "El descuento debe ser un porcentaje entre 0 y 100"})
		return
	}
	database.Exec(`
		UPDATE producto
		SET descuento_porcentaje = ?, descuento_inicio = ?, descuento_fin = ?
		WHERE id_producto = ?`,
		payload.DescuentoPorcentaje, nullString(payload.DescuentoInicio), nullString(payload.DescuentoFin), ctx.Param("id"))
	getProduct(ctx)
}

func uploadProductImage(ctx *gin.Context) {
	storeID, ok := productStore(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
		return
	}
	user, authenticated := currentUser(ctx)
	if !authenticated || !hasStoreRole(storeID, user, []string{"administrador"}) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "No tienes permisos para modificar este producto"})
		return
	}
	file, header, err := ctx.Request.FormFile("imagen")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": "Archivo imagen requerido"})
		return
	}
	defer file.Close()
	ext := filepath.Ext(header.Filename)
	name := fmt.Sprintf("producto-%s-%d%s", ctx.Param("id"), time.Now().Unix(), ext)
	relative := filepath.ToSlash(filepath.Join("uploads/products", name))
	destination := filepath.Join(uploadDir(), name)
	out, err := os.Create(destination)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	defer out.Close()
	io.Copy(out, file)
	database.Exec("UPDATE producto SET ruta_imagen = ? WHERE id_producto = ?", relative, ctx.Param("id"))
	getProduct(ctx)
}

func listCategories(ctx *gin.Context) {
	rows, err := database.Query("SELECT id_categoria, nombre, descripcion, estado FROM categoria ORDER BY nombre")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	defer rows.Close()
	categories := []gin.H{}
	for rows.Next() {
		var id, estado int
		var nombre, descripcion string
		rows.Scan(&id, &nombre, &descripcion, &estado)
		categories = append(categories, gin.H{"id_categoria": id, "nombre": nombre, "descripcion": descripcion, "estado": estado == 1})
	}
	ctx.JSON(http.StatusOK, categories)
}

func createCategory(ctx *gin.Context) {
	var payload CategoryPayload
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	result, err := database.Exec("INSERT INTO categoria (nombre, descripcion, estado) VALUES (?, ?, 1)", payload.Nombre, payload.Descripcion)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	id, _ := result.LastInsertId()
	ctx.JSON(http.StatusCreated, gin.H{"id_categoria": id, "nombre": payload.Nombre, "descripcion": payload.Descripcion, "estado": true})
}

func nullString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func intParam(ctx *gin.Context, name string) int {
	value, _ := strconv.Atoi(ctx.Param(name))
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

func hasStoreRole(storeID int, user map[string]any, roles []string) bool {
	if role, _ := user["rol_sistema"].(string); role == "admin_plataforma" {
		return true
	}
	userID := intFromAny(user["id_usuario"])
	if userID == 0 {
		return false
	}
	placeholders := make([]string, len(roles))
	args := []any{storeID, userID}
	for index, role := range roles {
		placeholders[index] = "?"
		args = append(args, role)
	}
	query := fmt.Sprintf(`
		SELECT 1
		FROM tienda_usuario
		WHERE id_tienda = ? AND id_usuario = ? AND cargo IN (%s) AND estado = 1
	`, strings.Join(placeholders, ","))
	var exists int
	err := database.QueryRow(query, args...).Scan(&exists)
	return err == nil
}

func productStore(productID any) (int, bool) {
	var storeID int
	err := database.QueryRow("SELECT id_tienda FROM producto WHERE id_producto = ?", productID).Scan(&storeID)
	return storeID, err == nil
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
