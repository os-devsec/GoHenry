package com.integrador.delivery;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class DeliveryService {
    private final JdbcTemplate jdbc;
    private final AuthService authService;
    private final UserClient userClient;

    public DeliveryService(JdbcTemplate jdbc, AuthService authService, UserClient userClient) {
        this.jdbc = jdbc;
        this.authService = authService;
        this.userClient = userClient;
    }

    public List<Map<String, Object>> disponibles(Map<String, Object> user) {
        if (!authService.isPlatformAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el admin de plataforma puede ver repartidores");
        }
        return userClient.deliveryUsers();
    }

    public List<Map<String, Object>> asignacionesPorRepartidor(int idUsuario, Map<String, Object> user) {
        if (!authService.isPlatformAdmin(user) && idUsuario != Utils.intValue(user.get("id_usuario"), 0)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo puedes ver tus asignaciones");
        }
        return assignments(baseSql() + " WHERE (ar.id_usuario = ? OR ar.estado_asignacion = 'pendiente') ORDER BY ar.id_asignacion DESC", idUsuario);
    }

    public List<Map<String, Object>> asignaciones(Integer pedido, Map<String, Object> user) {
        if (pedido != null) {
            if (!authService.isPlatformAdmin(user)) {
                return assignments(baseSql() + " WHERE ar.id_pedido = ? AND ar.id_usuario = ? ORDER BY ar.id_asignacion DESC", pedido, Utils.intValue(user.get("id_usuario"), 0));
            }
            return assignments(baseSql() + " WHERE ar.id_pedido = ? ORDER BY ar.id_asignacion DESC", pedido);
        }
        if (!authService.isPlatformAdmin(user)) {
            if (!Utils.boolValue(user.get("acepta_repartos"))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Activa modo delivery para ver asignaciones");
            }
            return assignments(baseSql() + " WHERE (ar.id_usuario = ? OR ar.estado_asignacion = 'pendiente') ORDER BY ar.id_asignacion DESC", Utils.intValue(user.get("id_usuario"), 0));
        }
        return assignments(baseSql() + " ORDER BY ar.id_asignacion DESC");
    }

    public Map<String, Object> crearAsignacion(Map<String, Object> body, Map<String, Object> user) {
        int idPedido = Utils.intValue(body.get("id_pedido"), 0);
        if (idPedido == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pedido requerido");
        }
        Map<String, Object> pedido = jdbc.queryForMap(
                "SELECT p.id_tienda, p.tipo_pedido, ep.nombre AS estado " +
                        "FROM pedido p JOIN estado_pedido ep ON ep.id_estado_pedido = p.id_estado_pedido " +
                        "WHERE p.id_pedido = ?",
                idPedido
        );
        if (!authService.isPlatformAdmin(user) && !authService.hasStoreRole(Utils.intValue(pedido.get("id_tienda"), 0), user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo la tienda puede solicitar delivery");
        }
        if (!"delivery".equals(Utils.stringValue(pedido.get("tipo_pedido"), ""))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Los pedidos pickup no requieren repartidor");
        }
        String estadoPedido = Utils.stringValue(pedido.get("estado"), "");
        if (Utils.set("pendiente", "cancelado", "rechazado", "entregado").contains(estadoPedido)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El pedido aun no esta listo para asignar delivery");
        }
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT TOP 1 id_asignacion FROM asignacion_repartidor WHERE id_pedido = ? AND estado_asignacion IN ('pendiente', 'aceptada', 'en_camino') ORDER BY id_asignacion DESC",
                idPedido
        );
        if (!existing.isEmpty()) {
            return asignacion(Utils.intValue(existing.get(0).get("id_asignacion"), 0));
        }
        int id = jdbc.queryForObject(
                "INSERT INTO asignacion_repartidor (id_pedido, id_usuario, estado_asignacion, observacion) " +
                        "OUTPUT INSERTED.id_asignacion VALUES (?, ?, 'pendiente', ?)",
                Integer.class,
                idPedido, null, Utils.stringValue(body.get("observacion"), null)
        );
        return asignacion(id);
    }

    @Transactional
    public Map<String, Object> aceptar(int id, Map<String, Object> user) {
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
                "SELECT ar.id_pedido, p.costo_envio " +
                        "FROM asignacion_repartidor ar " +
                        "JOIN pedido p ON p.id_pedido = ar.id_pedido " +
                        "WHERE ar.id_asignacion = ?",
                id
        );
        double monto = Utils.doubleValue(entrega.get("costo_envio"), 0);
        jdbc.update(
                "INSERT INTO comision (id_usuario, id_pedido, monto, estado_comision) VALUES (?, ?, ?, 'pendiente')",
                idUsuario,
                Utils.intValue(entrega.get("id_pedido"), 0),
                monto
        );
        return asignacion(id);
    }

    public Map<String, Object> enCamino(int id, Map<String, Object> user) {
        requireAssignedDeliveryUser(id, user);
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

    public Map<String, Object> cancelar(int id, Map<String, Object> body, Map<String, Object> user) {
        requireAssignedDeliveryUser(id, user);
        String observacion = body == null ? null : Utils.stringValue(body.get("observacion"), null);
        int updated = jdbc.update(
                "UPDATE asignacion_repartidor SET estado_asignacion = 'cancelada', fecha_cancelacion = CURRENT_TIMESTAMP, observacion = ? WHERE id_asignacion = ? AND estado_asignacion IN ('pendiente', 'aceptada')",
                observacion,
                id
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La entrega ya no se puede cancelar");
        }
        jdbc.update(
                "UPDATE comision SET estado_comision = 'cancelada' " +
                        "WHERE id_pedido = (SELECT id_pedido FROM asignacion_repartidor WHERE id_asignacion = ?)",
                id
        );
        return asignacion(id);
    }

    public Map<String, Object> entregar(int id, Map<String, Object> user) {
        requireAssignedDeliveryUser(id, user);
        int updated = jdbc.update(
                "UPDATE asignacion_repartidor SET estado_asignacion = 'entregada', fecha_entrega = CURRENT_TIMESTAMP WHERE id_asignacion = ? AND estado_asignacion = 'en_camino'",
                id
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La entrega debe estar en camino antes de marcarla entregada");
        }
        jdbc.update(
                "UPDATE comision SET estado_comision = 'pagada' " +
                        "WHERE id_pedido = (SELECT id_pedido FROM asignacion_repartidor WHERE id_asignacion = ?)",
                id
        );
        actualizarPedido(id, "entregado");
        return asignacion(id);
    }

    private void actualizarPedido(int idAsignacion, String estado) {
        Integer idPedido = jdbc.queryForObject("SELECT id_pedido FROM asignacion_repartidor WHERE id_asignacion = ?", Integer.class, idAsignacion);
        Integer estadoId = jdbc.queryForObject("SELECT id_estado_pedido FROM estado_pedido WHERE nombre = ?", Integer.class, estado);
        jdbc.update("UPDATE pedido SET id_estado_pedido = ? WHERE id_pedido = ?", estadoId, idPedido);
    }

    private Map<String, Object> asignacion(int id) {
        List<Map<String, Object>> rows = assignments(baseSql() + " WHERE ar.id_asignacion = ?", id);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Asignacion no encontrada");
        }
        return rows.get(0);
    }

    private String baseSql() {
        return "SELECT ar.id_asignacion, ar.id_pedido, ar.id_usuario AS id_repartidor, " +
                "p.id_usuario AS id_cliente, ar.estado_asignacion, p.tipo_pedido, p.fecha_pedido, " +
                "t.nombre AS tienda, t.logo_url AS logo_tienda, " +
                "u.nombre_lugar AS punto_entrega, u.referencia AS referencia_entrega, " +
                "p.subtotal, p.total_descuento, p.total, p.total AS costo_pedido, " +
                "p.costo_envio, ROUND(p.total + p.costo_envio, 2) AS total_con_envio, " +
                "COALESCE(c.monto, p.costo_envio) AS ganancia_envio, " +
                "ar.fecha_asignacion, ar.fecha_aceptacion, ar.fecha_entrega, ar.observacion, " +
                "t.nombre AS tienda_nombre " +
                "FROM asignacion_repartidor ar " +
                "JOIN pedido p ON ar.id_pedido = p.id_pedido " +
                "JOIN tienda t ON p.id_tienda = t.id_tienda " +
                "JOIN ubicacion u ON p.id_ubicacion_entrega = u.id_ubicacion " +
                "LEFT JOIN comision c ON c.id_pedido = p.id_pedido AND c.id_usuario = ar.id_usuario";
    }

    private List<Map<String, Object>> assignments(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        enrichAssignmentsWithUsers(rows);
        return rows;
    }

    private void enrichAssignmentsWithUsers(List<Map<String, Object>> assignments) {
        List<Integer> ids = new java.util.ArrayList<>();
        for (Map<String, Object> assignment : assignments) {
            ids.add(Utils.intValue(assignment.get("id_repartidor"), 0));
            ids.add(Utils.intValue(assignment.get("id_cliente"), 0));
        }
        Map<Integer, Map<String, Object>> usersById = userClient.publicUsersById(ids);
        for (Map<String, Object> assignment : assignments) {
            Map<String, Object> deliveryUser = usersById.get(Utils.intValue(assignment.get("id_repartidor"), 0));
            Map<String, Object> clientUser = usersById.get(Utils.intValue(assignment.get("id_cliente"), 0));
            String deliveryName = deliveryUser == null ? null : fullName(deliveryUser);
            assignment.put("repartidor", deliveryName);
            assignment.put("nombre", deliveryName);
            assignment.put("apellido", "");
            assignment.put("cliente", clientUser == null ? null : fullName(clientUser));
            if (clientUser != null && Utils.set("aceptada", "en_camino").contains(Utils.stringValue(assignment.get("estado_asignacion"), ""))) {
                assignment.put("telefono_cliente", clientUser.get("telefono"));
            } else {
                assignment.put("telefono_cliente", null);
            }
        }
    }

    private String fullName(Map<String, Object> user) {
        String nombre = Utils.stringValue(user.get("nombre"), "").trim();
        String apellido = Utils.stringValue(user.get("apellido"), "").trim();
        return (nombre + " " + apellido).trim();
    }

    private void requireAssignedDeliveryUser(int idAsignacion, Map<String, Object> user) {
        if (authService.isPlatformAdmin(user)) return;
        Integer idUsuario = jdbc.queryForObject("SELECT id_usuario FROM asignacion_repartidor WHERE id_asignacion = ?", Integer.class, idAsignacion);
        if (idUsuario == null || idUsuario != Utils.intValue(user.get("id_usuario"), 0)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el repartidor asignado puede cambiar esta entrega");
        }
    }

    private int claimDeliveryUser(int idAsignacion, Map<String, Object> user) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT id_usuario, estado_asignacion FROM asignacion_repartidor WHERE id_asignacion = ?", idAsignacion);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Asignacion no encontrada");
        }
        if (!Utils.boolValue(user.get("acepta_repartos"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Activa modo delivery para aceptar entregas");
        }
        String estado = Utils.stringValue(rows.get(0).get("estado_asignacion"), "");
        int currentUserId = Utils.intValue(user.get("id_usuario"), 0);
        int assignedUserId = Utils.intValue(rows.get(0).get("id_usuario"), 0);
        if (!"pendiente".equals(estado) && assignedUserId != currentUserId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La entrega ya pertenece a otro repartidor");
        }
        return currentUserId;
    }
}
