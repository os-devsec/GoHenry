package main

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
)

func databaseURL() string {
	if directURL := os.Getenv("SQLSERVER_DSN"); directURL != "" {
		return directURL
	}
	host := requiredEnv("RDS_HOST")
	port := fallback(os.Getenv("RDS_PORT"), "1433")
	databaseName := requiredEnv("RDS_DB")
	connectionURL := &url.URL{
		Scheme: "sqlserver",
		User:   url.UserPassword(requiredEnv("RDS_USER"), requiredEnv("RDS_PASSWORD")),
		Host:   net.JoinHostPort(host, port),
	}
	query := connectionURL.Query()
	query.Set("database", databaseName)
	query.Set("encrypt", "true")
	query.Set("TrustServerCertificate", "false")
	connectionURL.RawQuery = query.Encode()
	return connectionURL.String()
}

func requiredEnv(name string) string {
	value := os.Getenv(name)
	if value == "" {
		panic(fmt.Sprintf("missing required environment variable: %s", name))
	}
	return value
}

func fallback(value string, alternative string) string {
	if strings.TrimSpace(value) == "" {
		return alternative
	}
	return value
}

func uploadDir() string {
	dir := os.Getenv("UPLOAD_DIR")
	if dir == "" {
		dir = "uploads/products"
	}
	os.MkdirAll(dir, 0755)
	return dir
}

func restaurantServiceURL() string {
	url := os.Getenv("RESTAURANT_SERVICE_URL")
	if url == "" {
		url = "http://restaurant-service:8000"
	}
	return strings.TrimRight(url, "/")
}

func internalServiceToken() string {
	return requiredEnv("INTERNAL_SERVICE_TOKEN")
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func nullString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
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
