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

func canUseCart(ctx *gin.Context, cartID any) bool {
	user, ok := currentUser(ctx)
	if !ok {
		return false
	}
	if isPlatformAdmin(user) {
		return true
	}
	ownerID, err := queries.CartOwner(cartID)
	return err == nil && ownerID == intFromAny(user["id_usuario"])
}

func isPlatformAdmin(user map[string]any) bool {
	role, _ := user["rol_usuario"].(string)
	return role == "admin_plataforma"
}
