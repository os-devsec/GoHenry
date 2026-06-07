package com.integrador.payments;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@SpringBootApplication
@RestController
public class PaymentsApplication {
    private final JdbcTemplate jdbc;

    public PaymentsApplication(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static void main(String[] args) {
        SpringApplication.run(PaymentsApplication.class, args);
    }

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedOriginPattern("*");
        config.addAllowedHeader("*");
        config.addAllowedMethod("*");
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return map("status", "ok", "service", "payments-service");
    }

    @GetMapping("/api/v1/metodos-pago")
    public List<Map<String, Object>> metodos() {
        return jdbc.queryForList("SELECT * FROM metodo_pago WHERE estado = 1 ORDER BY id_metodo_pago");
    }

    @GetMapping("/api/v1/pagos")
    public List<Map<String, Object>> pagos(@RequestHeader(value = "Authorization", required = false) String authorization) {
        requirePlatformAdmin(currentUser(authorization));
        return jdbc.queryForList("SELECT * FROM pago ORDER BY id_pago DESC");
    }

    @GetMapping("/api/v1/pedidos/{idPedido}/pago")
    public Map<String, Object> pagoPorPedidoEndpoint(@PathVariable int idPedido,
                                                     @RequestHeader(value = "Authorization", required = false) String authorization) {
        requireOrderOwnerOrAdmin(idPedido, currentUser(authorization));
        return pagoPorPedido(idPedido);
    }

    private Map<String, Object> pagoPorPedido(int idPedido) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM pago WHERE id_pedido = ?", idPedido);
        return rows.isEmpty() ? Collections.emptyMap() : rows.get(0);
    }

    @PostMapping("/api/v1/pedidos/{idPedido}/pago")
    public Map<String, Object> crearPago(@PathVariable int idPedido,
                                         @RequestBody Map<String, Object> body,
                                         @RequestHeader(value = "Authorization", required = false) String authorization) {
        requireOrderOwnerOrAdmin(idPedido, currentUser(authorization));
        int metodo = intValue(body.get("id_metodo_pago"), 1);
        double monto = doubleValue(body.get("monto_total"), 0);
        String estado = stringValue(body.get("estado_pago"), "pagado");
        if (!set("pendiente", "pagado", "rechazado").contains(estado)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado de pago invalido");
        }
        List<Map<String, Object>> methods = jdbc.queryForList(
                "SELECT 1 FROM metodo_pago WHERE id_metodo_pago = ? AND estado = 1",
                metodo
        );
        if (methods.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Metodo de pago invalido");
        }
        if (monto == 0) {
            monto = jdbc.queryForObject("SELECT total FROM pedido WHERE id_pedido = ?", Double.class, idPedido);
        }
        jdbc.update("INSERT OR REPLACE INTO pago (id_pedido, id_metodo_pago, monto_total, estado_pago) VALUES (?, ?, ?, ?)",
                idPedido, metodo, monto, estado);
        return pagoPorPedido(idPedido);
    }

    @GetMapping("/api/v1/comisiones")
    public List<Map<String, Object>> comisiones(@RequestHeader(value = "Authorization", required = false) String authorization) {
        requirePlatformAdmin(currentUser(authorization));
        return jdbc.queryForList("SELECT * FROM comision ORDER BY id_comision DESC");
    }

    private static int intValue(Object value, int fallback) {
        if (value instanceof Number) return ((Number) value).intValue();
        if (value instanceof String && !((String) value).isEmpty()) return Integer.parseInt((String) value);
        return fallback;
    }

    private static double doubleValue(Object value, double fallback) {
        if (value instanceof Number) return ((Number) value).doubleValue();
        if (value instanceof String && !((String) value).isEmpty()) return Double.parseDouble((String) value);
        return fallback;
    }

    private static String stringValue(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    private static Map<String, String> map(String k1, String v1, String k2, String v2) {
        Map<String, String> map = new HashMap<>();
        map.put(k1, v1);
        map.put(k2, v2);
        return map;
    }

    private Map<String, Object> currentUser(String authorization) {
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
            return response.getBody();
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token invalido");
        }
    }

    private void requireOrderOwnerOrAdmin(int idPedido, Map<String, Object> user) {
        if (isPlatformAdmin(user)) return;
        Integer idUsuario = jdbc.queryForObject("SELECT id_usuario FROM pedido WHERE id_pedido = ?", Integer.class, idPedido);
        if (idUsuario == null || idUsuario != intValue(user.get("id_usuario"), 0)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permisos para este pago");
        }
    }

    private void requirePlatformAdmin(Map<String, Object> user) {
        if (!isPlatformAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el admin de plataforma puede realizar esta accion");
        }
    }

    private boolean isPlatformAdmin(Map<String, Object> user) {
        return "admin_plataforma".equals(stringValue(user.get("rol_usuario"), ""));
    }

    private static Set<String> set(String... values) {
        return new HashSet<>(Arrays.asList(values));
    }
}
