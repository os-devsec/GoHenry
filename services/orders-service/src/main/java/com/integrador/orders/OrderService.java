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
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.NoSuchElementException;

@Service
public class OrderService {
    private final JdbcTemplate jdbc;
    private final AuthService authService;
    private final UserClient userClient;

    public OrderService(JdbcTemplate jdbc, AuthService authService, UserClient userClient) {
        this.jdbc = jdbc;
        this.authService = authService;
        this.userClient = userClient;
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
        enrichOrdersWithUsers(pedidos);
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
        enrichOrdersWithUsers(rows);
        Map<String, Object> pedido = rows.get(0);
        pedido.put("items", items(id));
        return pedido;
    }

    public Map<String, Object> pedidoResumen(int id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id_pedido, id_usuario, id_tienda, subtotal, total_descuento, costo_envio, total, " +
                        "ROUND(total + costo_envio, 2) AS total_con_envio " +
                        "FROM pedido WHERE id_pedido = ?",
                id
        );
        if (rows.isEmpty()) {
            throw new NoSuchElementException("Pedido no encontrado");
        }
        return rows.get(0);
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
                    "SELECT id_tienda, estado, precio, descuento_porcentaje, descuento_inicio, descuento_fin " +
                            "FROM producto WHERE id_producto = ?",
                    productId
            );
            if (Utils.intValue(product.get("id_tienda"), 0) != idTienda || Utils.intValue(product.get("estado"), 0) != 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Todos los productos deben estar activos y pertenecer a la tienda");
            }
            double price = Utils.doubleValue(product.get("precio"), 0);
            double discountPercentage = descuentoActivo(product)
                    ? Utils.doubleValue(product.get("descuento_porcentaje"), 0)
                    : 0;
            double discount = Utils.roundMoney(price * discountPercentage / 100.0);
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
        double costoEnvio = "delivery".equals(tipo)
                ? calcularCostoEnvio(idTienda, idUbicacionEntrega)
                : 0;

        int idPedido = jdbc.queryForObject(
                "INSERT INTO pedido (id_usuario, id_tienda, id_estado_pedido, id_ubicacion_entrega, tipo_pedido, subtotal, total_descuento, costo_envio, total) " +
                        "OUTPUT INSERTED.id_pedido VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)",
                Integer.class,
                idUsuario, idTienda, idUbicacionEntrega, tipo, subtotal, totalDescuento, costoEnvio, total
        );
        for (Map<String, Object> item : normalized) {
            jdbc.update("INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, descuento_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
                    idPedido, item.get("id_producto"), item.get("cantidad"), item.get("precio_unitario"), item.get("descuento_unitario"), item.get("subtotal"));
        }
        return pedido(idPedido);
    }

    public Map<String, Object> cotizarEnvio(Map<String, Object> body) {
        int idTienda = Utils.intValue(body.get("id_tienda"), 0);
        int idUbicacion = Utils.intValue(body.get("id_ubicacion_entrega"), 0);
        String destinationName = Utils.stringValue(body.get("nombre_lugar"), "").trim();
        String destinationReference = Utils.stringValue(body.get("referencia"), "").trim();
        if (idTienda <= 0 || (idUbicacion <= 0 && destinationName.isEmpty())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tienda y ubicacion de entrega requeridas"
            );
        }

        Map<String, Object> route = idUbicacion > 0
                ? ubicacionesParaEnvio(idTienda, idUbicacion)
                : ubicacionTienda(idTienda);
        if (idUbicacion <= 0) {
            route.put("destino", destinationName);
            route.put("referencia_destino", destinationReference);
        }
        double cost = DeliveryFeeCalculator.calculate(
                textoUbicacion(route.get("origen"), route.get("referencia_origen")),
                textoUbicacion(route.get("destino"), route.get("referencia_destino"))
        );
        Map<String, Object> quote = new HashMap<>();
        quote.put("id_tienda", idTienda);
        quote.put("id_ubicacion_entrega", idUbicacion > 0 ? idUbicacion : null);
        quote.put("origen", route.get("origen"));
        quote.put("destino", route.get("destino"));
        quote.put("referencia_origen", route.get("referencia_origen"));
        quote.put("referencia_destino", route.get("referencia_destino"));
        quote.put("costo_envio", cost);
        return quote;
    }

    public Map<String, Object> actualizarEstado(int id, Map<String, Object> body, Map<String, Object> user) {
        Map<String, Object> orderState = jdbc.queryForMap(
                "SELECT p.id_tienda, p.tipo_pedido, ep.nombre AS estado " +
                        "FROM pedido p JOIN estado_pedido ep ON ep.id_estado_pedido = p.id_estado_pedido " +
                        "WHERE p.id_pedido = ?",
                id
        );
        Integer idTienda = Utils.intValue(orderState.get("id_tienda"), 0);
        if (!authService.hasStoreRole(idTienda, user, Utils.set("administrador", "empleado"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permisos para cambiar este pedido");
        }
        String estadoActual = Utils.stringValue(orderState.get("estado"), "");
        String tipoPedido = Utils.stringValue(orderState.get("tipo_pedido"), "");
        String estado = Utils.stringValue(body.get("estado"), "en_preparacion");
        boolean validTransition =
                ("pendiente".equals(estadoActual) && Utils.set("aceptado", "en_preparacion", "rechazado").contains(estado))
                || ("en_preparacion".equals(estadoActual) && "listo_para_entrega".equals(estado))
                || ("pickup".equals(tipoPedido) && "listo_para_entrega".equals(estadoActual) && "entregado".equals(estado));
        if (!validTransition) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Transicion de estado no permitida para este pedido"
            );
        }
        Integer estadoId = jdbc.queryForObject("SELECT id_estado_pedido FROM estado_pedido WHERE nombre = ?", Integer.class, estado);
        jdbc.update("UPDATE pedido SET id_estado_pedido = ? WHERE id_pedido = ?", estadoId, id);
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
        return "SELECT p.*, ROUND(p.total + p.costo_envio, 2) AS total_con_envio, " +
                "ep.nombre AS estado_nombre, t.nombre AS tienda_nombre, " +
                "ue.nombre_lugar AS nombre_lugar_entrega, ue.referencia AS referencia_entrega " +
                "FROM pedido p JOIN estado_pedido ep ON ep.id_estado_pedido = p.id_estado_pedido " +
                "JOIN tienda t ON t.id_tienda = p.id_tienda " +
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
                "SELECT TOP 1 ar.id_asignacion, ar.id_pedido, ar.id_usuario, ar.estado_asignacion, " +
                        "ar.id_usuario AS id_repartidor " +
                        "FROM asignacion_repartidor ar " +
                        "WHERE ar.id_pedido = ? ORDER BY ar.id_asignacion DESC",
                idPedido
        );
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> assignment = rows.get(0);
        int deliveryUserId = Utils.intValue(assignment.get("id_usuario"), 0);
        Map<String, Object> deliveryUser = userClient.publicUser(deliveryUserId);
        if (deliveryUser != null) {
            assignment.put("nombre", deliveryUser.get("nombre"));
            assignment.put("apellido", deliveryUser.get("apellido"));
            if (Utils.set("aceptada", "en_camino").contains(Utils.stringValue(assignment.get("estado_asignacion"), ""))) {
                assignment.put("telefono", deliveryUser.get("telefono"));
            } else {
                assignment.put("telefono", null);
            }
        }
        return assignment;
    }

    private void ocultarDatosDeEntregaParaTienda(Map<String, Object> pedido) {
        pedido.remove("cliente_telefono");
        pedido.put("total_tienda", pedido.get("total"));
    }

    private void enrichOrdersWithUsers(List<Map<String, Object>> pedidos) {
        List<Integer> ids = new ArrayList<>();
        for (Map<String, Object> pedido : pedidos) {
            ids.add(Utils.intValue(pedido.get("id_usuario"), 0));
        }
        Map<Integer, Map<String, Object>> usersById = userClient.publicUsersById(ids);
        for (Map<String, Object> pedido : pedidos) {
            Map<String, Object> user = usersById.get(Utils.intValue(pedido.get("id_usuario"), 0));
            if (user == null) {
                pedido.put("cliente_nombre", null);
                pedido.put("cliente_telefono", null);
            } else {
                pedido.put("cliente_nombre", fullName(user));
                pedido.put("cliente_telefono", user.get("telefono"));
            }
        }
    }

    private String fullName(Map<String, Object> user) {
        String nombre = Utils.stringValue(user.get("nombre"), "").trim();
        String apellido = Utils.stringValue(user.get("apellido"), "").trim();
        return (nombre + " " + apellido).trim();
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
        return jdbc.queryForObject(
                "INSERT INTO ubicacion (nombre_lugar, referencia, tipo_ubicacion, estado) " +
                        "OUTPUT INSERTED.id_ubicacion VALUES (?, ?, 'entrega', 1)",
                Integer.class,
                nombreLugar,
                referencia
        );
    }

    private double calcularCostoEnvio(int idTienda, int idUbicacionEntrega) {
        Map<String, Object> locations = ubicacionesParaEnvio(idTienda, idUbicacionEntrega);
        return DeliveryFeeCalculator.calculate(
                textoUbicacion(locations.get("origen"), locations.get("referencia_origen")),
                textoUbicacion(locations.get("destino"), locations.get("referencia_destino"))
        );
    }

    private Map<String, Object> ubicacionTienda(int idTienda) {
        return jdbc.queryForMap(
                "SELECT ut.nombre_lugar AS origen, ut.referencia AS referencia_origen " +
                        "FROM tienda t JOIN ubicacion ut ON ut.id_ubicacion = t.id_ubicacion " +
                        "WHERE t.id_tienda = ? AND t.estado = 1",
                idTienda
        );
    }

    private Map<String, Object> ubicacionesParaEnvio(int idTienda, int idUbicacionEntrega) {
        return jdbc.queryForMap(
                "SELECT ut.nombre_lugar AS origen, ut.referencia AS referencia_origen, " +
                        "ue.nombre_lugar AS destino, ue.referencia AS referencia_destino " +
                        "FROM tienda t " +
                        "JOIN ubicacion ut ON ut.id_ubicacion = t.id_ubicacion " +
                        "JOIN ubicacion ue ON ue.id_ubicacion = ? " +
                        "WHERE t.id_tienda = ?",
                idUbicacionEntrega,
                idTienda
        );
    }

    private String textoUbicacion(Object nombre, Object referencia) {
        return (Utils.stringValue(nombre, "") + " " + Utils.stringValue(referencia, "")).trim();
    }

    private boolean descuentoActivo(Map<String, Object> product) {
        double percentage = Utils.doubleValue(product.get("descuento_porcentaje"), 0);
        String startValue = Utils.stringValue(product.get("descuento_inicio"), "").trim();
        String endValue = Utils.stringValue(product.get("descuento_fin"), "").trim();
        if (percentage <= 0 || startValue.isEmpty() || endValue.isEmpty()) {
            return false;
        }
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:mm");
            LocalTime start = LocalTime.parse(startValue, formatter);
            LocalTime end = LocalTime.parse(endValue, formatter);
            LocalTime now = LocalTime.now(ZoneId.of("America/Guayaquil"));
            return start.isBefore(end) && !now.isBefore(start) && now.isBefore(end);
        } catch (DateTimeParseException error) {
            return false;
        }
    }
}
