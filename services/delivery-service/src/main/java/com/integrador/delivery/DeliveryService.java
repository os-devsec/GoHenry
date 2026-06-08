package com.integrador.delivery;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DeliveryService {
    private final JdbcTemplate jdbc;
    private final AuthService authService;

    public DeliveryService(JdbcTemplate jdbc, AuthService authService) {
        this.jdbc = jdbc;
        this.authService = authService;
    }

    public List<Map<String, Object>> disponibles(Map<String, Object> user) {
        if (!authService.isPlatformAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el admin de plataforma puede ver repartidores");
        }
        return jdbc.queryForList("SELECT id_usuario, nombre, apellido, correo, telefono, acepta_repartos, estado FROM usuario WHERE acepta_repartos = 1 AND estado = 1 ORDER BY id_usuario");
    }

    public List<Map<String, Object>> asignacionesPorRepartidor(int idUsuario, Map<String, Object> user) {
        if (!authService.isPlatformAdmin(user) && idUsuario != Utils.intValue(user.get("id_usuario"), 0)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo puedes ver tus asignaciones");
        }
        return jdbc.queryForList(baseSql() + " WHERE (v.id_repartidor = ? OR v.estado_asignacion = 'pendiente') ORDER BY v.id_asignacion DESC", idUsuario);
    }

    public List<Map<String, Object>> asignaciones(Integer pedido, Map<String, Object> user) {
        if (pedido != null) {
            if (!authService.isPlatformAdmin(user)) {
                return jdbc.queryForList(baseSql() + " WHERE v.id_pedido = ? AND v.id_repartidor = ? ORDER BY v.id_asignacion DESC", pedido, Utils.intValue(user.get("id_usuario"), 0));
            }
            return jdbc.queryForList(baseSql() + " WHERE v.id_pedido = ? ORDER BY v.id_asignacion DESC", pedido);
        }
        if (!authService.isPlatformAdmin(user)) {
            if (!Utils.boolValue(user.get("acepta_repartos"))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Activa modo delivery para ver asignaciones");
            }
            return jdbc.queryForList(baseSql() + " WHERE (v.id_repartidor = ? OR v.estado_asignacion = 'pendiente') ORDER BY v.id_asignacion DESC", Utils.intValue(user.get("id_usuario"), 0));
        }
        return jdbc.queryForList(baseSql() + " ORDER BY v.id_asignacion DESC");
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
                "SELECT id_asignacion FROM asignacion_repartidor WHERE id_pedido = ? AND estado_asignacion IN ('pendiente', 'aceptada', 'en_camino') ORDER BY id_asignacion DESC LIMIT 1",
                idPedido
        );
        if (!existing.isEmpty()) {
            return asignacion(Utils.intValue(existing.get(0).get("id_asignacion"), 0));
        }
        jdbc.update("INSERT INTO asignacion_repartidor (id_pedido, id_usuario, estado_asignacion, observacion) VALUES (?, ?, 'pendiente', ?)",
                idPedido, null, Utils.stringValue(body.get("observacion"), null));
        int id = jdbc.queryForObject("SELECT last_insert_rowid()", Integer.class);
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
                Utils.stringValue(entrega.get("ubicacion_tienda"), ""),
                Utils.stringValue(entrega.get("ubicacion_entrega"), "")
        );
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

    private double calcularComision(String ubicacionTienda, String ubicacionEntrega) {
        return esZonaEspecial(ubicacionTienda) && !esZonaEspecial(ubicacionEntrega) ? 1.0 : 0.5;
    }

    private boolean esZonaEspecial(String value) {
        String text = value == null ? "" : value.toLowerCase(Locale.ROOT);
        return text.contains("automotriz") || text.contains("gastronomia");
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
