package com.integrador.orders;

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
public class OrdersApplication {
    private final JdbcTemplate jdbc;

    public OrdersApplication(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static void main(String[] args) {
        SpringApplication.run(OrdersApplication.class, args);
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
        return map("status", "ok", "service", "orders-service");
    }

    @GetMapping("/api/v1/estados-pedido")
    public List<Map<String, Object>> estados() {
        return jdbc.queryForList("SELECT * FROM estado_pedido ORDER BY id_estado_pedido");
    }

    @GetMapping("/api/v1/ubicaciones")
    public List<Map<String, Object>> ubicaciones(@RequestParam(required = false, defaultValue = "entrega") String tipo,
                                                 @RequestHeader(value = "Authorization", required = false) String authorization) {
        currentUser(authorization);
        if (!set("tienda", "entrega").contains(tipo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de ubicacion invalido");
        }
        return jdbc.queryForList(
                "SELECT id_ubicacion, nombre_lugar, referencia, tipo_ubicacion, estado " +
                        "FROM ubicacion WHERE tipo_ubicacion = ? AND estado = 1 ORDER BY nombre_lugar",
                tipo
        );
    }

    @GetMapping("/api/v1/pedidos")
    public List<Map<String, Object>> pedidos(@RequestParam(required = false) Integer tienda,
                                             @RequestParam(required = false) Integer usuario,
                                             @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        if (tienda != null && !hasStoreRole(tienda, user, set("administrador", "empleado"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permisos para ver pedidos de esta tienda");
        }
        if (usuario != null && usuario != intValue(user.get("id_usuario"), 0) && !isPlatformAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo puedes ver tus propios pedidos");
        }
        String sql = basePedidoSql() + " WHERE 1=1";
        List<Object> args = new ArrayList<>();
        if (tienda != null) {
            sql += " AND p.id_tienda = ?";
            args.add(tienda);
        }
        if (usuario != null) {
            sql += " AND p.id_usuario = ?";
            args.add(usuario);
        }
        sql += " ORDER BY p.id_pedido DESC";
        List<Map<String, Object>> pedidos = jdbc.queryForList(sql, args.toArray());
        for (Map<String, Object> pedido : pedidos) {
            pedido.put("items", items(((Number) pedido.get("id_pedido")).intValue()));
            if (tienda != null) {
                ocultarDatosDeEntregaParaTienda(pedido);
            }
        }
        return pedidos;
    }

    @GetMapping("/api/v1/pedidos/{id}")
    public Map<String, Object> pedidoEndpoint(@PathVariable int id,
                                              @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        Map<String, Object> pedido = pedido(id);
        if (!canReadOrder(pedido, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permisos para ver este pedido");
        }
        pedido.put("asignacion", asignacionParaCliente(id, pedido, user));
        return pedido;
    }

    private Map<String, Object> pedido(int id) {
        List<Map<String, Object>> rows = jdbc.queryForList(basePedidoSql() + " WHERE p.id_pedido = ?", id);
        if (rows.isEmpty()) {
            throw new NoSuchElementException("Pedido no encontrado");
        }
        Map<String, Object> pedido = rows.get(0);
        pedido.put("items", items(id));
        return pedido;
    }

    @PostMapping("/api/v1/pedidos")
    @Transactional
    public Map<String, Object> crearPedido(@RequestBody Map<String, Object> body,
                                           @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        int idUsuario = intValue(body.get("id_usuario"), 1);
        if (idUsuario != intValue(user.get("id_usuario"), 0) && !isPlatformAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes crear pedidos para otro usuario");
        }
        int idTienda = intValue(body.get("id_tienda"), 1);
        String tipo = stringValue(body.get("tipo_pedido"), "delivery");
        if (!set("delivery", "pickup").contains(tipo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tipo de pedido debe ser delivery o pickup");
        }
        int idUbicacionEntrega = resolverUbicacionEntrega(body, idTienda, tipo);
        List<Map<String, Object>> requestItems = (List<Map<String, Object>>) body.getOrDefault("items", Collections.emptyList());
        if (requestItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido debe incluir al menos un plato");
        }

        double subtotal = 0;
        double totalDescuento = 0;
        List<Map<String, Object>> normalized = new ArrayList<>();
        for (Map<String, Object> item : requestItems) {
            int productId = intValue(first(item, "id_producto", "id"), 0);
            int qty = intValue(first(item, "cantidad", "quantity"), 1);
            if (qty <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad de cada producto debe ser mayor a cero");
            }
            Map<String, Object> product = jdbc.queryForMap(
                    "SELECT id_tienda, estado, precio, " +
                            "ROUND(precio * descuento_porcentaje / 100.0, 2) AS descuento_unitario " +
                            "FROM producto WHERE id_producto = ?",
                    productId
            );
            if (intValue(product.get("id_tienda"), 0) != idTienda || intValue(product.get("estado"), 0) != 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Todos los productos deben estar activos y pertenecer a la tienda");
            }
            double price = doubleValue(product.get("precio"), 0);
            double discount = doubleValue(product.get("descuento_unitario"), 0);
            double lineSubtotal = roundMoney((price - discount) * qty);
            subtotal += price * qty;
            totalDescuento += discount * qty;
            Map<String, Object> line = new HashMap<>();
            line.put("id_producto", productId);
            line.put("cantidad", qty);
            line.put("precio_unitario", price);
            line.put("descuento_unitario", discount);
            line.put("subtotal", lineSubtotal);
            normalized.add(line);
        }
        subtotal = roundMoney(subtotal);
        totalDescuento = roundMoney(totalDescuento);
        double total = roundMoney(subtotal - totalDescuento);

        jdbc.update("INSERT INTO pedido (id_usuario, id_tienda, id_estado_pedido, id_ubicacion_entrega, tipo_pedido, subtotal, total_descuento, total) " +
                        "VALUES (?, ?, 1, ?, ?, ?, ?, ?)",
                idUsuario, idTienda, idUbicacionEntrega, tipo, subtotal, totalDescuento, total);
        int idPedido = jdbc.queryForObject("SELECT last_insert_rowid()", Integer.class);
        for (Map<String, Object> item : normalized) {
            jdbc.update("INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, descuento_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
                    idPedido, item.get("id_producto"), item.get("cantidad"), item.get("precio_unitario"), item.get("descuento_unitario"), item.get("subtotal"));
        }
        return pedido(idPedido);
    }

    @PatchMapping("/api/v1/pedidos/{id}/estado")
    public Map<String, Object> actualizarEstado(@PathVariable int id,
                                                @RequestBody Map<String, Object> body,
                                                @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        Integer idTienda = jdbc.queryForObject("SELECT id_tienda FROM pedido WHERE id_pedido = ?", Integer.class, id);
        if (!hasStoreRole(idTienda, user, set("administrador", "empleado"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permisos para cambiar este pedido");
        }
        String estadoActual = jdbc.queryForObject(
                "SELECT ep.nombre FROM pedido p JOIN estado_pedido ep ON ep.id_estado_pedido = p.id_estado_pedido WHERE p.id_pedido = ?",
                String.class,
                id
        );
        if (!"pendiente".equals(estadoActual)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El pedido ya fue respondido");
        }
        String estado = stringValue(body.get("estado"), "en_preparacion");
        if (!set("aceptado", "en_preparacion", "rechazado").contains(estado)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado no permitido para la tienda");
        }
        Integer estadoId = jdbc.queryForObject("SELECT id_estado_pedido FROM estado_pedido WHERE nombre = ?", Integer.class, estado);
        jdbc.update("UPDATE V_Actualizar_Estado_Pedido SET id_estado_pedido = ? WHERE id_pedido = ?", estadoId, id);
        return pedido(id);
    }

    @PatchMapping("/api/v1/pedidos/{id}/cancelar")
    public Map<String, Object> cancelarPedido(@PathVariable int id,
                                              @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> user = currentUser(authorization);
        int idUsuario = intValue(user.get("id_usuario"), 0);
        Integer canceladoId = jdbc.queryForObject(
                "SELECT id_estado_pedido FROM estado_pedido WHERE nombre = 'cancelado'",
                Integer.class
        );
        int updated = jdbc.update(
                "UPDATE pedido SET id_estado_pedido = ? WHERE id_pedido = ? AND id_usuario = ? " +
                        "AND id_estado_pedido = (SELECT id_estado_pedido FROM estado_pedido WHERE nombre = 'pendiente')",
                canceladoId,
                id,
                idUsuario
        );
        if (updated == 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Solo puedes cancelar tu pedido antes de que la tienda lo acepte"
            );
        }
        return pedido(id);
    }

    private String basePedidoSql() {
        return "SELECT p.*, ep.nombre AS estado_nombre, t.nombre AS tienda_nombre, " +
                "u.nombre || ' ' || u.apellido AS cliente_nombre, u.telefono AS cliente_telefono, " +
                "ue.nombre_lugar AS nombre_lugar_entrega, ue.referencia AS referencia_entrega " +
                "FROM pedido p JOIN estado_pedido ep ON ep.id_estado_pedido = p.id_estado_pedido " +
                "JOIN tienda t ON t.id_tienda = p.id_tienda JOIN usuario u ON u.id_usuario = p.id_usuario " +
                "JOIN ubicacion ue ON ue.id_ubicacion = p.id_ubicacion_entrega";
    }

    private List<Map<String, Object>> items(int idPedido) {
        return jdbc.queryForList("SELECT dp.*, pr.nombre, pr.imagen_url FROM detalle_pedido dp JOIN producto pr ON pr.id_producto = dp.id_producto WHERE dp.id_pedido = ?", idPedido);
    }

    private Map<String, Object> asignacionParaCliente(int idPedido, Map<String, Object> pedido, Map<String, Object> user) {
        if (intValue(pedido.get("id_usuario"), 0) != intValue(user.get("id_usuario"), 0)) {
            return null;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT ar.id_asignacion, ar.id_pedido, ar.id_usuario, ar.estado_asignacion, " +
                        "u.nombre, u.apellido, " +
                        "CASE WHEN ar.estado_asignacion IN ('aceptada', 'en_camino') THEN u.telefono ELSE NULL END AS telefono " +
                        "FROM asignacion_repartidor ar LEFT JOIN usuario u ON u.id_usuario = ar.id_usuario " +
                        "WHERE ar.id_pedido = ? ORDER BY ar.id_asignacion DESC LIMIT 1",
                idPedido
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void ocultarDatosDeEntregaParaTienda(Map<String, Object> pedido) {
        pedido.remove("cliente_telefono");
        pedido.put("total_tienda", pedido.get("total"));
    }

    private int resolverUbicacionEntrega(Map<String, Object> body, int idTienda, String tipo) {
        if ("pickup".equals(tipo)) {
            Integer idUbicacion = jdbc.queryForObject(
                    "SELECT id_ubicacion FROM tienda WHERE id_tienda = ? AND estado = 1",
                    Integer.class,
                    idTienda
            );
            if (idUbicacion == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La tienda no tiene una ubicacion valida");
            }
            return idUbicacion;
        }

        int requestedId = intValue(body.get("id_ubicacion_entrega"), 0);
        if (requestedId > 0) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id_ubicacion FROM ubicacion " +
                            "WHERE id_ubicacion = ? AND tipo_ubicacion = 'entrega' AND estado = 1",
                    requestedId
            );
            if (rows.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La ubicacion de entrega no existe o esta inactiva");
            }
            return requestedId;
        }

        String nombreLugar = stringValue(body.get("nombre_lugar"), "").trim();
        String referencia = stringValue(body.get("referencia"), null);
        if (nombreLugar.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona una ubicacion o registra un nuevo lugar de entrega");
        }
        jdbc.update(
                "INSERT INTO ubicacion (nombre_lugar, referencia, tipo_ubicacion, estado) VALUES (?, ?, 'entrega', 1)",
                nombreLugar,
                referencia
        );
        return jdbc.queryForObject("SELECT last_insert_rowid()", Integer.class);
    }

    private static double roundMoney(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static Object first(Map<String, Object> map, String a, String b) {
        return map.containsKey(a) ? map.get(a) : map.get(b);
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

    private boolean canReadOrder(Map<String, Object> pedido, Map<String, Object> user) {
        if (isPlatformAdmin(user)) return true;
        int idUsuario = intValue(pedido.get("id_usuario"), 0);
        if (idUsuario == intValue(user.get("id_usuario"), 0)) return true;
        int idTienda = intValue(pedido.get("id_tienda"), 0);
        return hasStoreRole(idTienda, user, set("administrador", "empleado"));
    }

    private boolean isPlatformAdmin(Map<String, Object> user) {
        return "admin_plataforma".equals(stringValue(user.get("rol_usuario"), ""));
    }

    private boolean hasStoreRole(int idTienda, Map<String, Object> user, Set<String> roles) {
        if (isPlatformAdmin(user)) return true;
        int idUsuario = intValue(user.get("id_usuario"), 0);
        if (idUsuario == 0) return false;
        String placeholders = String.join(",", Collections.nCopies(roles.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(idTienda);
        args.add(idUsuario);
        args.addAll(roles);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 1 FROM tienda_usuario WHERE id_tienda = ? AND id_usuario = ? AND cargo IN (" + placeholders + ") AND estado = 1",
                args.toArray()
        );
        return !rows.isEmpty();
    }

    private static Set<String> set(String... values) {
        return new HashSet<>(Arrays.asList(values));
    }
}
