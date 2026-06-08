package com.integrador.payments;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class PaymentService {
    private final PaymentRepository payments;
    private final AuthService authService;

    public PaymentService(PaymentRepository payments, AuthService authService) {
        this.payments = payments;
        this.authService = authService;
    }

    public List<Map<String, Object>> metodos() {
        return payments.metodosActivos();
    }

    public List<Map<String, Object>> pagos(String authorization) {
        authService.requirePlatformAdmin(authService.currentUser(authorization));
        return payments.pagos();
    }

    public Map<String, Object> pagoPorPedido(int idPedido, String authorization) {
        requireOrderOwnerOrAdmin(idPedido, authService.currentUser(authorization));
        return payments.pagoPorPedido(idPedido);
    }

    public Map<String, Object> crearPago(int idPedido, Map<String, Object> body, String authorization) {
        requireOrderOwnerOrAdmin(idPedido, authService.currentUser(authorization));

        int metodo = Utils.intValue(body.get("id_metodo_pago"), 1);
        double monto = Utils.doubleValue(body.get("monto_total"), 0);
        String estado = Utils.stringValue(body.get("estado_pago"), "pagado");

        if (!Utils.set("pendiente", "pagado", "rechazado").contains(estado)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado de pago invalido");
        }
        if (!payments.metodoPagoActivo(metodo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Metodo de pago invalido");
        }
        if (monto == 0) {
            monto = payments.totalPedido(idPedido);
        }
        payments.guardarPago(idPedido, metodo, monto, estado);
        return payments.pagoPorPedido(idPedido);
    }

    public List<Map<String, Object>> comisiones(String authorization) {
        authService.requirePlatformAdmin(authService.currentUser(authorization));
        return payments.comisiones();
    }

    private void requireOrderOwnerOrAdmin(int idPedido, Map<String, Object> user) {
        if (authService.isPlatformAdmin(user)) return;
        Integer idUsuario = payments.usuarioDelPedido(idPedido);
        if (idUsuario == null || idUsuario != Utils.intValue(user.get("id_usuario"), 0)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permisos para este pago");
        }
    }
}
