package main

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

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
	if role, _ := user["rol_usuario"].(string); role == "admin_plataforma" {
		return true
	}
	userID := intFromAny(user["id_usuario"])
	if userID == 0 {
		return false
	}
	return queries.HasStoreRole(storeID, userID, roles)
}
