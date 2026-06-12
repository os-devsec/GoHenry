package com.integrador.payments;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Repository
public class PaymentRepository {
    private final JdbcTemplate jdbc;

    public PaymentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> metodosActivos() {
        return jdbc.queryForList("SELECT * FROM metodo_pago WHERE estado = 1 ORDER BY id_metodo_pago");
    }

    public List<Map<String, Object>> pagos() {
        return jdbc.queryForList(
                "SELECT p.*, mp.nombre AS metodo_pago FROM pago p " +
                        "JOIN metodo_pago mp ON mp.id_metodo_pago = p.id_metodo_pago " +
                        "ORDER BY p.id_pago DESC"
        );
    }

    public Map<String, Object> pagoPorPedido(int idPedido) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.*, mp.nombre AS metodo_pago FROM pago p " +
                        "JOIN metodo_pago mp ON mp.id_metodo_pago = p.id_metodo_pago " +
                        "WHERE p.id_pedido = ?",
                idPedido
        );
        return rows.isEmpty() ? Collections.emptyMap() : rows.get(0);
    }

    public boolean metodoPagoActivo(int idMetodoPago) {
        return !jdbc.queryForList(
                "SELECT 1 FROM metodo_pago WHERE id_metodo_pago = ? AND estado = 1",
                idMetodoPago
        ).isEmpty();
    }

    public void guardarPago(int idPedido, int metodo, double monto, String estado) {
        jdbc.update(
                "UPDATE pago SET id_metodo_pago = ?, monto_total = ?, estado_pago = ?, fecha_pago = CURRENT_TIMESTAMP " +
                        "WHERE id_pedido = ?; " +
                        "IF @@ROWCOUNT = 0 " +
                        "INSERT INTO pago (id_pedido, id_metodo_pago, monto_total, estado_pago) VALUES (?, ?, ?, ?)",
                metodo,
                monto,
                estado,
                idPedido,
                idPedido,
                metodo,
                monto,
                estado
        );
    }

    public List<Map<String, Object>> comisiones() {
        return jdbc.queryForList("SELECT * FROM comision ORDER BY id_comision DESC");
    }
}
