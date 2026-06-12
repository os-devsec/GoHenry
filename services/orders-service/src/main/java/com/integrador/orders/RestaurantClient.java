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
import java.util.Set;

@Service
public class RestaurantClient {
    @SuppressWarnings("unchecked")
    public boolean hasStoreStaffRole(int idTienda, int idUsuario, Set<String> roles) {
        if (idTienda == 0 || idUsuario == 0 || roles.isEmpty()) return false;
        String restaurantUrl = System.getenv().getOrDefault("RESTAURANT_SERVICE_URL", "http://restaurant-service:8000");
        String internalToken = Utils.requiredEnv("INTERNAL_SERVICE_TOKEN");

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Internal-Token", internalToken);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(
                Utils.objectMap("id_usuario", idUsuario, "roles", roles),
                headers
        );
        try {
            ResponseEntity<Map> response = new RestTemplate().exchange(
                    restaurantUrl + "/internal/tiendas/" + idTienda + "/personal/permisos",
                    HttpMethod.POST,
                    entity,
                    Map.class
            );
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            return body != null && Boolean.TRUE.equals(body.get("allowed"));
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo consultar permisos de tienda");
        }
    }
}
