package com.integrador.payments;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class PaymentController {
    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Utils.map("status", "ok", "service", "payments-service");
    }

    @GetMapping("/api/v1/metodos-pago")
    public List<Map<String, Object>> metodos() {
        return paymentService.metodos();
    }

    @GetMapping("/api/v1/pagos")
    public List<Map<String, Object>> pagos(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return paymentService.pagos(authorization);
    }

    @GetMapping("/api/v1/pedidos/{idPedido}/pago")
    public Map<String, Object> pagoPorPedidoEndpoint(@PathVariable int idPedido,
                                                     @RequestHeader(value = "Authorization", required = false) String authorization) {
        return paymentService.pagoPorPedido(idPedido, authorization);
    }

    @PostMapping("/api/v1/pedidos/{idPedido}/pago")
    public Map<String, Object> crearPago(@PathVariable int idPedido,
                                         @RequestBody Map<String, Object> body,
                                         @RequestHeader(value = "Authorization", required = false) String authorization) {
        return paymentService.crearPago(idPedido, body, authorization);
    }

    @GetMapping("/api/v1/comisiones")
    public List<Map<String, Object>> comisiones(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return paymentService.comisiones(authorization);
    }
}
