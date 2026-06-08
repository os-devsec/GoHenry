package com.integrador.orders;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.NoSuchElementException;

@Service
public class OrderService {
    private final JdbcTemplate jdbc;
    private final AuthService authService;

    public OrderService(JdbcTemplate jdbc, AuthService authService) {
        this.jdbc = jdbc;
        this.authService = authService;
    }

    public List<Map<String, Object>> estados() {
        return jdbc.queryForList("SELECT * FROM estado_pedido ORDER BY id_estado_pedido");
    }

    public List<Map<String, Object>> ubicaciones(String tipo) {
        if (!Utils.set("tienda", "entrega").contains(tipo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de ubicacion invalido");
        }
        return jdbc.queryForList(
                "SELECT id_ubicacion, nombre_lugar, referencia, tipo_ubicacion, estado " +
                        "FROM ubicacion WHERE tipo_ubicacion = ? AND estado = 1 ORDER BY nombre_lugar",
                tipo
        );
    }

    public List<Map<String, Object>> pedidos(Integer tienda, Integer usuario, Map<String, Object> user) {
        if (tienda != null && !authService.hasStoreRole(tienda, user, Utils.set("administrador", "empleado"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permisos para ver pedidos de esta tienda");
        }
        if (usuario != null && usuario != Utils.intValue(user.get("id_usuario"), 0) && !authService.isPlatformAdmin(user)) {
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

    public Map<String, Object> pedidoEndpoint(int id, Map<String, Object> user) {
        Map<String, Object> pedido = pedido(id);
        if (!authService.canReadOrder(pedido, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permisos para ver este pedido");
        }
        pedido.put("asignacion", asignacionParaCliente(id, pedido, user));
        return pedido;
    }

    public Map<String, Object> pedido(int id) {
        List<Map<String, Object>> rows = jdbc.queryForList(basePedidoSql() + " WHERE p.id_pedido = ?", id);
        if (rows.isEmpty()) {
            throw new NoSuchElementException("Pedido no encontrado");
        }
        Map<String, Object> pedido = rows.get(0);
        pedido.put("items", items(id));
        return pedido;
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> crearPedido(Map<String, Object> body, Map<String, Object> user) {
        int idUsuario = Utils.intValue(body.get("id_usuario"), 1);
        if (idUsuario != Utils.intValue(user.get("id_usuario"), 0) && !authService.isPlatformAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes crear pedidos para otro usuario");
        }
        int idTienda = Utils.intValue(body.get("id_tienda"), 1);
        String tipo = Utils.stringValue(body.get("tipo_pedido"), "delivery");
        if (!Utils.set("delivery", "pickup").contains(tipo)) {
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
            int productId = Utils.intValue(Utils.first(item, "id_producto", "id"), 0);
            int qty = Utils.intValue(Utils.first(item, "cantidad", "quantity"), 1);
            if (qty <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad de cada producto debe ser mayor a cero");
            }
            Map<String, Object> product = jdbc.queryForMap(
                    "SELECT id_tienda, estado, precio, " +
                            "ROUND(precio * descuento_porcentaje / 100.0, 2) AS descuento_unitario " +
                            "FROM producto WHERE id_producto = ?",
                    productId
            );
            if (Utils.intValue(product.get("id_tienda"), 0) != idTienda || Utils.intValue(product.get("estado"), 0) != 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Todos los productos deben estar activos y pertenecer a la tienda");
            }
            double price = Utils.doubleValue(product.get("precio"), 0);
            double discount = Utils.doubleValue(product.get("descuento_unitario"), 0);
            double lineSubtotal = Utils.roundMoney((price - discount) * qty);
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
        subtotal = Utils.roundMoney(subtotal);
        totalDescuento = Utils.roundMoney(totalDescuento);
        double total = Utils.roundMoney(subtotal - totalDescuento);

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

    public Map<String, Object> actualizarEstado(int id, Map<String, Object> body, Map<String, Object> user) {
        Integer idTienda = jdbc.queryForObject("SELECT id_tienda FROM pedido WHERE id_pedido = ?", Integer.class, id);
        if (!authService.hasStoreRole(idTienda, user, Utils.set("administrador", "empleado"))) {
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
        String estado = Utils.stringValue(body.get("estado"), "en_preparacion");
        if (!Utils.set("aceptado", "en_preparacion", "rechazado").contains(estado)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado no permitido para la tienda");
        }
        Integer estadoId = jdbc.queryForObject("SELECT id_estado_pedido FROM estado_pedido WHERE nombre = ?", Integer.class, estado);
        jdbc.update("UPDATE V_Actualizar_Estado_Pedido SET id_estado_pedido = ? WHERE id_pedido = ?", estadoId, id);
        return pedido(id);
    }

    public Map<String, Object> cancelarPedido(int id, Map<String, Object> user) {
        int idUsuario = Utils.intValue(user.get("id_usuario"), 0);
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
        if (Utils.intValue(pedido.get("id_usuario"), 0) != Utils.intValue(user.get("id_usuario"), 0)) {
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

        int requestedId = Utils.intValue(body.get("id_ubicacion_entrega"), 0);
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

        String nombreLugar = Utils.stringValue(body.get("nombre_lugar"), "").trim();
        String referencia = Utils.stringValue(body.get("referencia"), null);
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
}
