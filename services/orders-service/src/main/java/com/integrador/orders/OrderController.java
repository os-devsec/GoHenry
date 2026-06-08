package com.integrador.orders;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class OrderController {
    private final AuthService authService;
    private final OrderService orderService;

    public OrderController(AuthService authService, OrderService orderService) {
        this.authService = authService;
        this.orderService = orderService;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Utils.map("status", "ok", "service", "orders-service");
    }

    @GetMapping("/api/v1/estados-pedido")
    public List<Map<String, Object>> estados() {
        return orderService.estados();
    }

    @GetMapping("/api/v1/ubicaciones")
    public List<Map<String, Object>> ubicaciones(@RequestParam(required = false, defaultValue = "entrega") String tipo,
                                                 @RequestHeader(value = "Authorization", required = false) String authorization) {
        authService.currentUser(authorization);
        return orderService.ubicaciones(tipo);
    }

    @GetMapping("/api/v1/pedidos")
    public List<Map<String, Object>> pedidos(@RequestParam(required = false) Integer tienda,
                                             @RequestParam(required = false) Integer usuario,
                                             @RequestHeader(value = "Authorization", required = false) String authorization) {
        return orderService.pedidos(tienda, usuario, authService.currentUser(authorization));
    }

    @GetMapping("/api/v1/pedidos/{id}")
    public Map<String, Object> pedidoEndpoint(@PathVariable int id,
                                              @RequestHeader(value = "Authorization", required = false) String authorization) {
        return orderService.pedidoEndpoint(id, authService.currentUser(authorization));
    }

    @PostMapping("/api/v1/pedidos")
    public Map<String, Object> crearPedido(@RequestBody Map<String, Object> body,
                                           @RequestHeader(value = "Authorization", required = false) String authorization) {
        return orderService.crearPedido(body, authService.currentUser(authorization));
    }

    @PatchMapping("/api/v1/pedidos/{id}/estado")
    public Map<String, Object> actualizarEstado(@PathVariable int id,
                                                @RequestBody Map<String, Object> body,
                                                @RequestHeader(value = "Authorization", required = false) String authorization) {
        return orderService.actualizarEstado(id, body, authService.currentUser(authorization));
    }

    @PatchMapping("/api/v1/pedidos/{id}/cancelar")
    public Map<String, Object> cancelarPedido(@PathVariable int id,
                                              @RequestHeader(value = "Authorization", required = false) String authorization) {
        return orderService.cancelarPedido(id, authService.currentUser(authorization));
    }
}
