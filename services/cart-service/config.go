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
	connectionURL := &url.URL{
		Scheme: "sqlserver",
		User:   url.UserPassword(requiredEnv("RDS_USER"), requiredEnv("RDS_PASSWORD")),
		Host:   net.JoinHostPort(requiredEnv("RDS_HOST"), requiredEnv("RDS_PORT")),
	}
	query := connectionURL.Query()
	query.Set("database", requiredEnv("RDS_DB"))
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
