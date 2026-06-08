package main

import (
	"os"
	"strconv"
	"strings"
)

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
