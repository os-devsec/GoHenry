package com.integrador.delivery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@SpringBootApplication
@RestController
public class DeliveryApplication {
    private final JdbcTemplate jdbc;

    public DeliveryApplication(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static void main(String[] args) {
        SpringApplication.run(DeliveryApplication.class, args);
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
        return map("status", "ok", "service", "delivery-service");
    }

    @GetMapping("/api/v1/repartidores/disponibles")
    public List<Map<String, Object>> disponibles(@RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        if (!isPlatformAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el admin de plataforma puede ver repartidores");
        }
        return jdbc.queryForList("SELECT id_usuario, nombre, apellido, correo, telefono, acepta_repartos, estado FROM usuario WHERE acepta_repartos = 1 AND estado = 1 ORDER BY id_usuario");
    }

    @GetMapping("/api/v1/repartidores/{idUsuario}/asignaciones")
    public List<Map<String, Object>> asignacionesPorRepartidor(@PathVariable int idUsuario,
                                                               @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        if (!isPlatformAdmin(user) && idUsuario != intValue(user.get("id_usuario"), 0)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo puedes ver tus asignaciones");
        }
        return jdbc.queryForList(baseSql() + " WHERE (v.id_repartidor = ? OR v.estado_asignacion = 'pendiente') ORDER BY v.id_asignacion DESC", idUsuario);
    }

    @GetMapping("/api/v1/asignaciones-repartidor")
    public List<Map<String, Object>> asignaciones(@RequestParam(required = false) Integer pedido,
                                                  @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        if (pedido != null) {
            if (!isPlatformAdmin(user)) {
                return jdbc.queryForList(baseSql() + " WHERE v.id_pedido = ? AND v.id_repartidor = ? ORDER BY v.id_asignacion DESC", pedido, intValue(user.get("id_usuario"), 0));
            }
            return jdbc.queryForList(baseSql() + " WHERE v.id_pedido = ? ORDER BY v.id_asignacion DESC", pedido);
        }
        if (!isPlatformAdmin(user)) {
            if (!boolValue(user.get("acepta_repartos"))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Activa modo delivery para ver asignaciones");
            }
            return jdbc.queryForList(baseSql() + " WHERE (v.id_repartidor = ? OR v.estado_asignacion = 'pendiente') ORDER BY v.id_asignacion DESC", intValue(user.get("id_usuario"), 0));
        }
        return jdbc.queryForList(baseSql() + " ORDER BY v.id_asignacion DESC");
    }

    @PostMapping("/api/v1/asignaciones-repartidor")
    public Map<String, Object> crearAsignacion(@RequestBody Map<String, Object> body,
                                               @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        int idPedido = intValue(body.get("id_pedido"), 0);
        if (idPedido == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pedido requerido");
        }
        Map<String, Object> pedido = jdbc.queryForMap(
                "SELECT p.id_tienda, p.tipo_pedido, ep.nombre AS estado " +
                        "FROM pedido p JOIN estado_pedido ep ON ep.id_estado_pedido = p.id_estado_pedido " +
                        "WHERE p.id_pedido = ?",
                idPedido
        );
        if (!isPlatformAdmin(user) && !hasStoreRole(intValue(pedido.get("id_tienda"), 0), user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo la tienda puede solicitar delivery");
        }
        if (!"delivery".equals(stringValue(pedido.get("tipo_pedido"), ""))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Los pedidos pickup no requieren repartidor");
        }
        String estadoPedido = stringValue(pedido.get("estado"), "");
        if (set("pendiente", "cancelado", "rechazado", "entregado").contains(estadoPedido)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El pedido aun no esta listo para asignar delivery");
        }
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id_asignacion FROM asignacion_repartidor WHERE id_pedido = ? AND estado_asignacion IN ('pendiente', 'aceptada', 'en_camino') ORDER BY id_asignacion DESC LIMIT 1",
                idPedido
        );
        if (!existing.isEmpty()) {
            return asignacion(intValue(existing.get(0).get("id_asignacion"), 0));
        }
        jdbc.update("INSERT INTO asignacion_repartidor (id_pedido, id_usuario, estado_asignacion, observacion) VALUES (?, ?, 'pendiente', ?)",
                idPedido, null, stringValue(body.get("observacion"), null));
        int id = jdbc.queryForObject("SELECT last_insert_rowid()", Integer.class);
        return asignacion(id);
    }

    @PatchMapping("/api/v1/asignaciones-repartidor/{id}/aceptar")
    @Transactional
    public Map<String, Object> aceptar(@PathVariable int id,
                                       @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        int idUsuario = claimDeliveryUser(id, user);
        int updated = jdbc.update(
                "UPDATE asignacion_repartidor " +
                        "SET id_usuario = ?, estado_asignacion = 'aceptada', fecha_aceptacion = CURRENT_TIMESTAMP " +
                        "WHERE id_asignacion = ? " +
                        "AND estado_asignacion = 'pendiente' " +
                        "AND NOT EXISTS ( " +
                        "  SELECT 1 " +
                        "  FROM asignacion_repartidor other " +
                        "  WHERE other.id_pedido = asignacion_repartidor.id_pedido " +
                        "    AND other.id_asignacion <> asignacion_repartidor.id_asignacion " +
                        "    AND other.estado_asignacion IN ('aceptada', 'en_camino', 'entregada') " +
                        ")",
                idUsuario,
                id
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La entrega ya fue tomada o no esta pendiente");
        }
        Map<String, Object> entrega = jdbc.queryForMap(
                "SELECT ar.id_pedido, " +
                        "COALESCE(ut.nombre_lugar, '') || ' ' || COALESCE(ut.referencia, '') AS ubicacion_tienda, " +
                        "COALESCE(ue.nombre_lugar, '') || ' ' || COALESCE(ue.referencia, '') AS ubicacion_entrega " +
                        "FROM asignacion_repartidor ar " +
                        "JOIN pedido p ON p.id_pedido = ar.id_pedido " +
                        "JOIN tienda t ON t.id_tienda = p.id_tienda " +
                        "JOIN ubicacion ut ON ut.id_ubicacion = t.id_ubicacion " +
                        "JOIN ubicacion ue ON ue.id_ubicacion = p.id_ubicacion_entrega " +
                        "WHERE ar.id_asignacion = ?",
                id
        );
        double monto = calcularComision(
                stringValue(entrega.get("ubicacion_tienda"), ""),
                stringValue(entrega.get("ubicacion_entrega"), "")
        );
        jdbc.update(
                "INSERT INTO comision (id_usuario, id_pedido, monto, estado_comision) VALUES (?, ?, ?, 'pendiente')",
                idUsuario,
                intValue(entrega.get("id_pedido"), 0),
                monto
        );
        return asignacion(id);
    }

    @PatchMapping("/api/v1/asignaciones-repartidor/{id}/en-camino")
    public Map<String, Object> enCamino(@PathVariable int id,
                                        @RequestHeader(value = "Authorization", required = false) String authorization) {
        requireAssignedDeliveryUser(id, currentUser(authorization));
        int updated = jdbc.update(
                "UPDATE asignacion_repartidor SET estado_asignacion = 'en_camino' WHERE id_asignacion = ? AND estado_asignacion = 'aceptada'",
                id
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La entrega debe estar aceptada antes de salir");
        }
        actualizarPedido(id, "en_camino");
        return asignacion(id);
    }

    @PatchMapping("/api/v1/asignaciones-repartidor/{id}/cancelar")
    public Map<String, Object> cancelar(@PathVariable int id,
                                        @RequestBody(required = false) Map<String, Object> body,
                                        @RequestHeader(value = "Authorization", required = false) String authorization) {
        requireAssignedDeliveryUser(id, currentUser(authorization));
        String observacion = body == null ? null : stringValue(body.get("observacion"), null);
        int updated = jdbc.update(
                "UPDATE asignacion_repartidor SET estado_asignacion = 'cancelada', fecha_cancelacion = CURRENT_TIMESTAMP, observacion = ? WHERE id_asignacion = ? AND estado_asignacion IN ('pendiente', 'aceptada')",
                observacion,
                id
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La entrega ya no se puede cancelar");
        }
        return asignacion(id);
    }

    @PatchMapping("/api/v1/asignaciones-repartidor/{id}/entregar")
    public Map<String, Object> entregar(@PathVariable int id,
                                        @RequestHeader(value = "Authorization", required = false) String authorization) {
        requireAssignedDeliveryUser(id, currentUser(authorization));
        int updated = jdbc.update(
                "UPDATE asignacion_repartidor SET estado_asignacion = 'entregada', fecha_entrega = CURRENT_TIMESTAMP WHERE id_asignacion = ? AND estado_asignacion = 'en_camino'",
                id
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La entrega debe estar en camino antes de marcarla entregada");
        }
        actualizarPedido(id, "entregado");
        return asignacion(id);
    }

    private void actualizarPedido(int idAsignacion, String estado) {
        Integer idPedido = jdbc.queryForObject("SELECT id_pedido FROM asignacion_repartidor WHERE id_asignacion = ?", Integer.class, idAsignacion);
        Integer estadoId = jdbc.queryForObject("SELECT id_estado_pedido FROM estado_pedido WHERE nombre = ?", Integer.class, estado);
        jdbc.update("UPDATE V_Actualizar_Estado_Pedido SET id_estado_pedido = ? WHERE id_pedido = ?", estadoId, idPedido);
    }

    private Map<String, Object> asignacion(int id) {
        return jdbc.queryForMap(baseSql() + " WHERE v.id_asignacion = ?", id);
    }

    private String baseSql() {
        return "SELECT v.id_asignacion, v.id_pedido, v.id_repartidor, v.repartidor, " +
                "v.estado_asignacion, v.tipo_pedido, v.fecha_pedido, v.tienda, v.cliente, " +
                "CASE WHEN v.estado_asignacion IN ('aceptada', 'en_camino') THEN v.telefono_cliente ELSE NULL END AS telefono_cliente, " +
                "v.punto_entrega, v.referencia_entrega, v.subtotal, v.total_descuento, v.total, " +
                "v.fecha_asignacion, v.fecha_aceptacion, v.fecha_entrega, v.observacion, " +
                "v.repartidor AS nombre, '' AS apellido, " +
                "v.tienda AS tienda_nombre " +
                "FROM V_Ordenes_Repartidor v";
    }

    private static int intValue(Object value, int fallback) {
        if (value instanceof Number) return ((Number) value).intValue();
        if (value instanceof String && !((String) value).isEmpty()) return Integer.parseInt((String) value);
        return fallback;
    }

    private static String stringValue(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    private double calcularComision(String ubicacionTienda, String ubicacionEntrega) {
        return esZonaEspecial(ubicacionTienda) && !esZonaEspecial(ubicacionEntrega) ? 1.0 : 0.5;
    }

    private boolean esZonaEspecial(String value) {
        String text = value == null ? "" : value.toLowerCase(Locale.ROOT);
        return text.contains("automotriz") || text.contains("gastronomia");
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

    private void requireAssignedDeliveryUser(int idAsignacion, Map<String, Object> user) {
        if (isPlatformAdmin(user)) return;
        Integer idUsuario = jdbc.queryForObject("SELECT id_usuario FROM asignacion_repartidor WHERE id_asignacion = ?", Integer.class, idAsignacion);
        if (idUsuario == null || idUsuario != intValue(user.get("id_usuario"), 0)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el repartidor asignado puede cambiar esta entrega");
        }
    }

    private int claimDeliveryUser(int idAsignacion, Map<String, Object> user) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT id_usuario, estado_asignacion FROM asignacion_repartidor WHERE id_asignacion = ?", idAsignacion);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Asignacion no encontrada");
        }
        if (!boolValue(user.get("acepta_repartos"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Activa modo delivery para aceptar entregas");
        }
        String estado = stringValue(rows.get(0).get("estado_asignacion"), "");
        int currentUserId = intValue(user.get("id_usuario"), 0);
        int assignedUserId = intValue(rows.get(0).get("id_usuario"), 0);
        if (!"pendiente".equals(estado) && assignedUserId != currentUserId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La entrega ya pertenece a otro repartidor");
        }
        return currentUserId;
    }

    private boolean hasStoreRole(int idTienda, Map<String, Object> user) {
        int idUsuario = intValue(user.get("id_usuario"), 0);
        if (idUsuario == 0) return false;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 1 FROM tienda_usuario " +
                        "WHERE id_tienda = ? AND id_usuario = ? AND cargo IN ('administrador', 'empleado') AND estado = 1",
                idTienda,
                idUsuario
        );
        return !rows.isEmpty();
    }

    private boolean isPlatformAdmin(Map<String, Object> user) {
        return "admin_plataforma".equals(stringValue(user.get("rol_usuario"), ""));
    }

    private static boolean boolValue(Object value) {
        if (value instanceof Boolean) return (Boolean) value;
        if (value instanceof Number) return ((Number) value).intValue() == 1;
        if (value instanceof String) return Boolean.parseBoolean((String) value) || "1".equals(value);
        return false;
    }

    private static Set<String> set(String... values) {
        return new HashSet<>(Arrays.asList(values));
    }
}
