package main

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	catalogdb "integrador/catalog-service/internal/db"

	"github.com/gin-gonic/gin"
)

func productMap(product catalogdb.ProductRow) (gin.H, error) {
	categories, err := queries.ListProductCategories(product.IDProducto)
	if err != nil {
		return nil, err
	}
	categoryMaps := []gin.H{}
	for _, category := range categories {
		categoryMaps = append(categoryMaps, gin.H{
			"id_categoria": category.IDCategoria,
			"nombre":       category.Nombre,
			"descripcion":  category.Descripcion,
		})
	}
	activeDiscount := discountActive(
		product.DescuentoPorcentaje,
		product.DescuentoInicio.String,
		product.DescuentoFin.String,
		time.Now(),
	)
	appliedDiscount := 0.0
	if activeDiscount {
		appliedDiscount = product.DescuentoPorcentaje
	}
	finalPrice := math.Round(product.Precio*(1-appliedDiscount/100)*100) / 100

	return gin.H{
		"id_producto":          product.IDProducto,
		"id_tienda":            product.IDTienda,
		"nombre":               product.Nombre,
		"descripcion":          product.Descripcion,
		"precio":               product.Precio,
		"stock":                product.Stock,
		"descuento_porcentaje": product.DescuentoPorcentaje,
		"descuento_inicio":     product.DescuentoInicio.String,
		"descuento_fin":        product.DescuentoFin.String,
		"descuento_activo":     activeDiscount,
		"descuento_aplicado":   appliedDiscount,
		"precio_final":         finalPrice,
		"imagen_url":           product.ImagenURL.String,
		"estado":               strings.EqualFold(product.Estado, "TRUE"),
		"tienda_nombre":        product.Tienda,
		"categorias":           categoryMaps,
		"categorias_texto":     product.Categorias,
	}, nil
}

func productMaps(products []catalogdb.ProductRow, categoryFilter string) ([]gin.H, error) {
	response := []gin.H{}
	for _, product := range products {
		mapped, err := productMap(product)
		if err != nil {
			return nil, err
		}
		if categoryFilter != "" && !matchesCategory(mapped["categorias"].([]gin.H), categoryFilter) {
			continue
		}
		response = append(response, mapped)
	}
	return response, nil
}

func matchesCategory(categories []gin.H, filter string) bool {
	filter = strings.TrimSpace(strings.ToLower(filter))
	for _, category := range categories {
		id := fmt.Sprint(category["id_categoria"])
		name := strings.ToLower(fmt.Sprint(category["nombre"]))
		if filter == id || filter == name {
			return true
		}
	}
	return false
}

func listProducts(ctx *gin.Context) {
	var products []catalogdb.ProductRow
	var err error
	if store := ctx.Query("tienda"); store != "" {
		products, err = queries.ListProductsByStore(store)
	} else {
		products, err = queries.ListProducts()
	}
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	response, err := productMaps(products, ctx.Query("categoria"))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, response)
}

func listProductsByStore(ctx *gin.Context) {
	products, err := queries.ListProductsByStore(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	response, err := productMaps(products, ctx.Query("categoria"))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, response)
}

func getProduct(ctx *gin.Context) {
	product, err := queries.GetProduct(ctx.Param("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	response, err := productMap(product)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, response)
}

func createProduct(ctx *gin.Context) {
	var payload ProductRequest
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	user, ok := currentUser(ctx)
	if !ok || !hasStoreRole(payload.IDTienda, user, []string{"administrador"}) {
		ctx.JSON(http.StatusForbidden, gin.H{"detail": "Solo administradores de tienda pueden crear productos"})
		return
	}
	discount, discountStart, discountEnd, discountError := normalizeDiscount(
		payload.DescuentoPorcentaje,
		payload.DescuentoInicio,
		payload.DescuentoFin,
	)
	if discountError != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": discountError.Error()})
		return
	}
	imageURL, imageError := normalizeImageURL(payload.ImagenURL)
	if imageError != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": imageError.Error()})
		return
	}
	estado := true
	if payload.Estado != nil {
		estado = *payload.Estado
	}
	id, err := queries.CreateProduct(catalogdb.CreateProductParams{
		IDTienda:            payload.IDTienda,
		Nombre:              payload.Nombre,
		Descripcion:         payload.Descripcion,
		Precio:              payload.Precio,
		Stock:               payload.Stock,
		DescuentoPorcentaje: discount,
		DescuentoInicio:     discountStart,
		DescuentoFin:        discountEnd,
		ImagenURL:           nullString(imageURL),
		Estado:              boolInt(estado),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if err := queries.SetProductCategories(id, payload.IDCategorias); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	product, err := queries.GetProduct(id)
	if err != nil {
		ctx.JSON(http.StatusCreated, gin.H{"id_producto": id})
		return
	}
	response, err := productMap(product)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, response)
}

func updateProduct(ctx *gin.Context) {
	var payload ProductRequest
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
	currentProduct, err := queries.GetProduct(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
		return
	}
	discount, discountStart, discountEnd, discountError := normalizeDiscount(
		payload.DescuentoPorcentaje,
		payload.DescuentoInicio,
		payload.DescuentoFin,
	)
	if discountError != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": discountError.Error()})
		return
	}
	imageURL, imageError := normalizeImageURL(payload.ImagenURL)
	if imageError != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": imageError.Error()})
		return
	}
	estado := strings.EqualFold(currentProduct.Estado, "TRUE")
	if payload.Estado != nil {
		estado = *payload.Estado
	}
	err = queries.UpdateProduct(catalogdb.UpdateProductParams{
		Nombre:              payload.Nombre,
		Descripcion:         payload.Descripcion,
		Precio:              payload.Precio,
		Stock:               payload.Stock,
		DescuentoPorcentaje: discount,
		DescuentoInicio:     discountStart,
		DescuentoFin:        discountEnd,
		ImagenURL:           nullString(imageURL),
		Estado:              boolInt(estado),
		IDProducto:          ctx.Param("id"),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if err := queries.SetProductCategories(ctx.Param("id"), payload.IDCategorias); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
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
	if err := queries.DeleteProduct(ctx.Param("id")); err != nil {
		if errors.Is(err, catalogdb.ErrProductHasOrders) {
			ctx.JSON(http.StatusConflict, gin.H{"detail": "No se puede borrar definitivamente un producto que ya tiene pedidos registrados"})
			return
		}
		if errors.Is(err, sql.ErrNoRows) {
			ctx.JSON(http.StatusNotFound, gin.H{"detail": "Producto no encontrado"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"ok": true})
}

func updateAvailability(ctx *gin.Context) {
	var payload AvailabilityRequest
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
	err := queries.UpdateProductAvailability(catalogdb.UpdateProductAvailabilityParams{
		Estado:     boolInt(payload.Estado),
		IDProducto: ctx.Param("id"),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	getProduct(ctx)
}

func updateDiscount(ctx *gin.Context) {
	var payload DiscountRequest
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
	discount, discountStart, discountEnd, discountError := normalizeDiscount(
		payload.DescuentoPorcentaje,
		payload.DescuentoInicio,
		payload.DescuentoFin,
	)
	if discountError != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": discountError.Error()})
		return
	}
	err := queries.UpdateProductDiscount(catalogdb.UpdateProductDiscountParams{
		DescuentoPorcentaje: discount,
		DescuentoInicio:     discountStart,
		DescuentoFin:        discountEnd,
		IDProducto:          ctx.Param("id"),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	getProduct(ctx)
}

func productStore(productID any) (int, bool) {
	storeID, err := queries.ProductStore(productID)
	return storeID, err == nil
}

func normalizeImageURL(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	parsed, err := url.ParseRequestURI(trimmed)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", fmt.Errorf("el enlace de imagen debe comenzar con http:// o https://")
	}
	return parsed.String(), nil
}
