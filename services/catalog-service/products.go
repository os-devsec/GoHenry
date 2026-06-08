package main

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	catalogdb "integrador/catalog-service/internal/db"

	"github.com/gin-gonic/gin"
)

func productMap(product catalogdb.ProductRow) gin.H {
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
		"imagen_url":           product.ImagenURL.String,
		"estado":               strings.EqualFold(product.Estado, "TRUE"),
		"tienda_nombre":        product.Tienda,
		"categorias":           product.Categorias,
	}
}

func productMaps(products []catalogdb.ProductRow) []gin.H {
	response := []gin.H{}
	for _, product := range products {
		response = append(response, productMap(product))
	}
	return response
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
	ctx.JSON(http.StatusOK, productMaps(products))
}

func listProductsByStore(ctx *gin.Context) {
	products, err := queries.ListProductsByStore(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, productMaps(products))
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
	ctx.JSON(http.StatusOK, productMap(product))
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
	if payload.DescuentoPorcentaje < 0 || payload.DescuentoPorcentaje > 100 {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": "El descuento debe ser un porcentaje entre 0 y 100"})
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
		DescuentoPorcentaje: payload.DescuentoPorcentaje,
		DescuentoInicio:     nullString(payload.DescuentoInicio),
		DescuentoFin:        nullString(payload.DescuentoFin),
		Estado:              boolInt(estado),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	product, err := queries.GetProduct(id)
	if err != nil {
		ctx.JSON(http.StatusCreated, gin.H{"id_producto": id})
		return
	}
	ctx.JSON(http.StatusCreated, productMap(product))
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
	if payload.DescuentoPorcentaje < 0 || payload.DescuentoPorcentaje > 100 {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": "El descuento debe ser un porcentaje entre 0 y 100"})
		return
	}
	err := queries.UpdateProduct(catalogdb.UpdateProductParams{
		Nombre:              payload.Nombre,
		Descripcion:         payload.Descripcion,
		Precio:              payload.Precio,
		Stock:               payload.Stock,
		DescuentoPorcentaje: payload.DescuentoPorcentaje,
		DescuentoInicio:     nullString(payload.DescuentoInicio),
		DescuentoFin:        nullString(payload.DescuentoFin),
		IDProducto:          ctx.Param("id"),
	})
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
	if err := queries.UpdateProductAvailability(catalogdb.UpdateProductAvailabilityParams{Estado: 0, IDProducto: ctx.Param("id")}); err != nil {
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
	if payload.DescuentoPorcentaje < 0 || payload.DescuentoPorcentaje > 100 {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": "El descuento debe ser un porcentaje entre 0 y 100"})
		return
	}
	err := queries.UpdateProductDiscount(catalogdb.UpdateProductDiscountParams{
		DescuentoPorcentaje: payload.DescuentoPorcentaje,
		DescuentoInicio:     nullString(payload.DescuentoInicio),
		DescuentoFin:        nullString(payload.DescuentoFin),
		IDProducto:          ctx.Param("id"),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
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
	if err := queries.UpdateProductImage(catalogdb.UpdateProductImageParams{ImagenURL: relative, IDProducto: ctx.Param("id")}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	getProduct(ctx)
}

func productStore(productID any) (int, bool) {
	storeID, err := queries.ProductStore(productID)
	return storeID, err == nil
}
