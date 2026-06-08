package com.integrador.delivery;

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
public class DeliveryController {
    private final AuthService authService;
    private final DeliveryService deliveryService;

    public DeliveryController(AuthService authService, DeliveryService deliveryService) {
        this.authService = authService;
        this.deliveryService = deliveryService;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Utils.map("status", "ok", "service", "delivery-service");
    }

    @GetMapping("/api/v1/repartidores/disponibles")
    public List<Map<String, Object>> disponibles(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return deliveryService.disponibles(authService.currentUser(authorization));
    }

    @GetMapping("/api/v1/repartidores/{idUsuario}/asignaciones")
    public List<Map<String, Object>> asignacionesPorRepartidor(@PathVariable int idUsuario,
                                                               @RequestHeader(value = "Authorization", required = false) String authorization) {
        return deliveryService.asignacionesPorRepartidor(idUsuario, authService.currentUser(authorization));
    }

    @GetMapping("/api/v1/asignaciones-repartidor")
    public List<Map<String, Object>> asignaciones(@RequestParam(required = false) Integer pedido,
                                                  @RequestHeader(value = "Authorization", required = false) String authorization) {
        return deliveryService.asignaciones(pedido, authService.currentUser(authorization));
    }

    @PostMapping("/api/v1/asignaciones-repartidor")
    public Map<String, Object> crearAsignacion(@RequestBody Map<String, Object> body,
                                               @RequestHeader(value = "Authorization", required = false) String authorization) {
        return deliveryService.crearAsignacion(body, authService.currentUser(authorization));
    }

    @PatchMapping("/api/v1/asignaciones-repartidor/{id}/aceptar")
    public Map<String, Object> aceptar(@PathVariable int id,
                                       @RequestHeader(value = "Authorization", required = false) String authorization) {
        return deliveryService.aceptar(id, authService.currentUser(authorization));
    }

    @PatchMapping("/api/v1/asignaciones-repartidor/{id}/en-camino")
    public Map<String, Object> enCamino(@PathVariable int id,
                                        @RequestHeader(value = "Authorization", required = false) String authorization) {
        return deliveryService.enCamino(id, authService.currentUser(authorization));
    }

    @PatchMapping("/api/v1/asignaciones-repartidor/{id}/cancelar")
    public Map<String, Object> cancelar(@PathVariable int id,
                                        @RequestBody(required = false) Map<String, Object> body,
                                        @RequestHeader(value = "Authorization", required = false) String authorization) {
        return deliveryService.cancelar(id, body, authService.currentUser(authorization));
    }

    @PatchMapping("/api/v1/asignaciones-repartidor/{id}/entregar")
    public Map<String, Object> entregar(@PathVariable int id,
                                        @RequestHeader(value = "Authorization", required = false) String authorization) {
        return deliveryService.entregar(id, authService.currentUser(authorization));
    }
}
