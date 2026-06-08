package com.integrador.orders;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class Utils {
    private Utils() {
    }

    static double roundMoney(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    static Object first(Map<String, Object> map, String a, String b) {
        return map.containsKey(a) ? map.get(a) : map.get(b);
    }

    static int intValue(Object value, int fallback) {
        if (value instanceof Number) return ((Number) value).intValue();
        if (value instanceof String && !((String) value).isEmpty()) return Integer.parseInt((String) value);
        return fallback;
    }

    static double doubleValue(Object value, double fallback) {
        if (value instanceof Number) return ((Number) value).doubleValue();
        if (value instanceof String && !((String) value).isEmpty()) return Double.parseDouble((String) value);
        return fallback;
    }

    static String stringValue(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    static Map<String, String> map(String k1, String v1, String k2, String v2) {
        Map<String, String> map = new HashMap<>();
        map.put(k1, v1);
        map.put(k2, v2);
        return map;
    }

    static Set<String> set(String... values) {
        return new HashSet<>(Arrays.asList(values));
    }
}
