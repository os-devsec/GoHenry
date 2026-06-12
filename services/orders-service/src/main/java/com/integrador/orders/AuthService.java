package com.integrador.orders;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class AuthService {
    private final RestaurantClient restaurantClient;

    public AuthService(RestaurantClient restaurantClient) {
        this.restaurantClient = restaurantClient;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> currentUser(String authorization) {
        if (authorization == null || authorization.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token requerido");
        }
        String authUrl = System.getenv().getOrDefault("AUTH_SERVICE_URL", "http://auth-service:8000");
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", authorization);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        try {
            ResponseEntity<Map> response = new RestTemplate().exchange(
                    authUrl + "/api/v1/auth/me",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );
            return (Map<String, Object>) response.getBody();
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token invalido");
        }
    }

    public boolean canReadOrder(Map<String, Object> pedido, Map<String, Object> user) {
        if (isPlatformAdmin(user)) return true;
        int idUsuario = Utils.intValue(pedido.get("id_usuario"), 0);
        if (idUsuario == Utils.intValue(user.get("id_usuario"), 0)) return true;
        int idTienda = Utils.intValue(pedido.get("id_tienda"), 0);
        return hasStoreRole(idTienda, user, Utils.set("administrador", "empleado"));
    }

    public boolean isPlatformAdmin(Map<String, Object> user) {
        return "admin_plataforma".equals(Utils.stringValue(user.get("rol_usuario"), ""));
    }

    public boolean hasStoreRole(int idTienda, Map<String, Object> user, Set<String> roles) {
        if (isPlatformAdmin(user)) return true;
        int idUsuario = Utils.intValue(user.get("id_usuario"), 0);
        if (idUsuario == 0) return false;
        return restaurantClient.hasStoreStaffRole(idTienda, idUsuario, roles);
    }

    public void requireInternalService(String internalToken) {
        String expected = Utils.requiredEnv("INTERNAL_SERVICE_TOKEN");
        if (internalToken == null || !Objects.equals(internalToken, expected)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Token interno invalido");
        }
    }
}
