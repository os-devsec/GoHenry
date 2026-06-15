package com.integrador.orders;

import java.text.Normalizer;
import java.util.Locale;

final class DeliveryFeeCalculator {
    private DeliveryFeeCalculator() {
    }

    static double calculate(String originValue, String destinationValue) {
        String originZone = specialZone(normalizeLocation(originValue));
        String destinationZone = specialZone(normalizeLocation(destinationValue));

        if (originZone != null && destinationZone != null && !originZone.equals(destinationZone)) {
            return 1.5;
        }
        if (originZone == null && destinationZone != null) {
            return 1.0;
        }
        return 0.5;
    }

    private static String specialZone(String location) {
        if (location.contains("gastronomia") || location.contains("automotriz")) {
            return "automotriz_gastronomia";
        }
        if (location.contains("deportes")) {
            return "deportes";
        }
        return null;
    }

    private static String normalizeLocation(String value) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return normalized.toLowerCase(Locale.ROOT).trim();
    }
}
