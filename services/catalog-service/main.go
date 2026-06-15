package main

import (
	"database/sql"
	"net/http"
	"os"

	catalogdb "integrador/catalog-service/internal/db"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/microsoft/go-mssqldb"
)

var database *sql.DB
var queries *catalogdb.Queries

func main() {
	var err error
	database, err = sql.Open("sqlserver", databaseURL())
	if err != nil {
		panic(err)
	}
	defer database.Close()
	if err = database.Ping(); err != nil {
		panic(err)
	}
	queries = catalogdb.New(database)

	router := gin.Default()
	router.Use(cors.Default())
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "ok", "service": "catalog-service"})
	})

	registerRoutes(router.Group("/api/v1"))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	router.Run("0.0.0.0:" + port)
}

func registerRoutes(api *gin.RouterGroup) {
	api.GET("/productos", listProducts)
	api.POST("/productos", createProduct)
	api.GET("/productos/:id", getProduct)
	api.PATCH("/productos/:id", updateProduct)
	api.DELETE("/productos/:id", deleteProduct)
	api.PATCH("/productos/:id/disponibilidad", updateAvailability)
	api.PATCH("/productos/:id/descuento", updateDiscount)
	api.GET("/categorias", listCategories)
	api.POST("/categorias", createCategory)
	api.GET("/tiendas/:id/productos", listProductsByStore)
}
