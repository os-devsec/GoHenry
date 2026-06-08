package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func listCategories(ctx *gin.Context) {
	categories, err := queries.ListCategories()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	response := []gin.H{}
	for _, category := range categories {
		response = append(response, gin.H{
			"id_categoria": category.IDCategoria,
			"nombre":       category.Nombre,
			"descripcion":  category.Descripcion,
			"estado":       category.Estado == 1,
		})
	}
	ctx.JSON(http.StatusOK, response)
}

func createCategory(ctx *gin.Context) {
	var payload CategoryRequest
	if err := ctx.BindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	id, err := queries.CreateCategory(payload.Nombre, payload.Descripcion)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"id_categoria": id, "nombre": payload.Nombre, "descripcion": payload.Descripcion, "estado": true})
}
