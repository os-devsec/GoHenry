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
