package com.integrador.delivery;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class UserClient {
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> deliveryUsers() {
        String usersUrl = System.getenv().getOrDefault("USERS_SERVICE_URL", "http://users-service:8000");
        String internalToken = Utils.requiredEnv("INTERNAL_SERVICE_TOKEN");
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Internal-Token", internalToken);
        try {
            ResponseEntity<List> response = new RestTemplate().exchange(
                    usersUrl + "/internal/usuarios/repartidores",
                    HttpMethod.GET,
                    new HttpEntity<Void>(headers),
                    List.class
            );
            List<Map<String, Object>> users = (List<Map<String, Object>>) response.getBody();
            return users == null ? new ArrayList<Map<String, Object>>() : users;
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo consultar users-service");
        }
    }

    @SuppressWarnings("unchecked")
    public Map<Integer, Map<String, Object>> publicUsersById(Collection<Integer> idsUsuario) {
        List<Integer> ids = new ArrayList<>();
        for (Integer id : idsUsuario) {
            if (id != null && id > 0 && !ids.contains(id)) {
                ids.add(id);
            }
        }
        Map<Integer, Map<String, Object>> usersById = new HashMap<>();
        if (ids.isEmpty()) {
            return usersById;
        }

        String usersUrl = System.getenv().getOrDefault("USERS_SERVICE_URL", "http://users-service:8000");
        String internalToken = Utils.requiredEnv("INTERNAL_SERVICE_TOKEN");
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Internal-Token", internalToken);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(
                Utils.objectMap("ids_usuario", ids),
                headers
        );
        try {
            ResponseEntity<List> response = new RestTemplate().exchange(
                    usersUrl + "/internal/usuarios/lookup",
                    HttpMethod.POST,
                    entity,
                    List.class
            );
            List<Map<String, Object>> users = (List<Map<String, Object>>) response.getBody();
            if (users == null) {
                return usersById;
            }
            for (Map<String, Object> user : users) {
                usersById.put(Utils.intValue(user.get("id_usuario"), 0), user);
            }
            return usersById;
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo consultar users-service");
        }
    }
}
