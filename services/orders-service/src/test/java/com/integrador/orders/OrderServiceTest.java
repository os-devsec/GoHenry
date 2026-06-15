package com.integrador.orders;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class OrderServiceTest {
    @Test
    void combinesDuplicateProductsAndSortsIdsForConsistentLocks() {
        List<Map<String, Object>> items = Arrays.asList(
                item(9, 2),
                item(3, 1),
                item(9, 4)
        );

        Map<Integer, Integer> quantities = OrderService.normalizeRequestedQuantities(items);

        assertEquals(Arrays.asList(3, 9), new ArrayList<>(quantities.keySet()));
        assertEquals(Integer.valueOf(6), quantities.get(9));
    }

    @Test
    void rejectsNonPositiveQuantities() {
        assertThrows(
                ResponseStatusException.class,
                () -> OrderService.normalizeRequestedQuantities(Arrays.asList(item(3, 0)))
        );
    }

    private Map<String, Object> item(int productId, int quantity) {
        Map<String, Object> item = new HashMap<>();
        item.put("id_producto", productId);
        item.put("cantidad", quantity);
        return item;
    }
}
