package com.integrador.payments;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
public class OrderClient {
    @SuppressWarnings("unchecked")
    public Map<String, Object> orderSummary(int idPedido) {
        String ordersUrl = System.getenv().getOrDefault("ORDERS_SERVICE_URL", "http://orders-service:8000");
        String internalToken = Utils.requiredEnv("INTERNAL_SERVICE_TOKEN");
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Internal-Token", internalToken);
        try {
            ResponseEntity<Map> response = new RestTemplate().exchange(
                    ordersUrl + "/internal/pedidos/" + idPedido + "/resumen",
                    HttpMethod.GET,
                    new HttpEntity<Void>(headers),
                    Map.class
            );
            return (Map<String, Object>) response.getBody();
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo consultar orders-service");
        }
    }
}
