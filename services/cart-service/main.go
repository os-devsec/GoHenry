package main

import (
	"database/sql"
	"net/http"
	"os"

	cartdb "integrador/cart-service/internal/db"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/microsoft/go-mssqldb"
)

var database *sql.DB
var queries *cartdb.Queries

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
	queries = cartdb.New(database)

	router := gin.Default()
	router.Use(cors.Default())
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "ok", "service": "cart-service"})
	})

	registerRoutes(router.Group("/api/v1"))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	router.Run("0.0.0.0:" + port)
}

func registerRoutes(api *gin.RouterGroup) {
	api.POST("/carritos", createCart)
	api.GET("/carritos/:id", getCart)
	api.POST("/carritos/:id/items", addItem)
	api.PATCH("/carritos/:id/items/:itemId", updateItem)
	api.DELETE("/carritos/:id/items/:itemId", deleteItem)
	api.POST("/carritos/:id/checkout", checkout)
}
