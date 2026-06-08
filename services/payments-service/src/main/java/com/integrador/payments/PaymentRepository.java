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
        return jdbc.queryForList("SELECT * FROM pago ORDER BY id_pago DESC");
    }

    public Map<String, Object> pagoPorPedido(int idPedido) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM pago WHERE id_pedido = ?", idPedido);
        return rows.isEmpty() ? Collections.emptyMap() : rows.get(0);
    }

    public boolean metodoPagoActivo(int idMetodoPago) {
        return !jdbc.queryForList(
                "SELECT 1 FROM metodo_pago WHERE id_metodo_pago = ? AND estado = 1",
                idMetodoPago
        ).isEmpty();
    }

    public double totalPedido(int idPedido) {
        Double total = jdbc.queryForObject("SELECT total FROM pedido WHERE id_pedido = ?", Double.class, idPedido);
        return total == null ? 0 : total;
    }

    public void guardarPago(int idPedido, int metodo, double monto, String estado) {
        jdbc.update(
                "INSERT OR REPLACE INTO pago (id_pedido, id_metodo_pago, monto_total, estado_pago) VALUES (?, ?, ?, ?)",
                idPedido,
                metodo,
                monto,
                estado
        );
    }

    public List<Map<String, Object>> comisiones() {
        return jdbc.queryForList("SELECT * FROM comision ORDER BY id_comision DESC");
    }

    public Integer usuarioDelPedido(int idPedido) {
        return jdbc.queryForObject("SELECT id_usuario FROM pedido WHERE id_pedido = ?", Integer.class, idPedido);
    }
}
