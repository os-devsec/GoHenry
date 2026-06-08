package com.integrador.payments;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Map;

@Service
public class AuthService {
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

    public void requirePlatformAdmin(Map<String, Object> user) {
        if (!isPlatformAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el admin de plataforma puede realizar esta accion");
        }
    }

    public boolean isPlatformAdmin(Map<String, Object> user) {
        return "admin_plataforma".equals(Utils.stringValue(user.get("rol_usuario"), ""));
    }
}
