package com.integrador.delivery;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class AuthService {
    private final JdbcTemplate jdbc;

    public AuthService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
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

    public boolean hasStoreRole(int idTienda, Map<String, Object> user) {
        int idUsuario = Utils.intValue(user.get("id_usuario"), 0);
        if (idUsuario == 0) return false;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 1 FROM tienda_usuario " +
                        "WHERE id_tienda = ? AND id_usuario = ? AND cargo IN ('administrador', 'empleado') AND estado = 1",
                idTienda,
                idUsuario
        );
        return !rows.isEmpty();
    }

    public boolean isPlatformAdmin(Map<String, Object> user) {
        return "admin_plataforma".equals(Utils.stringValue(user.get("rol_usuario"), ""));
    }
}
