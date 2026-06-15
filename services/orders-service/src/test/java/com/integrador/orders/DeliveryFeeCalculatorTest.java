package com.integrador.orders;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DeliveryFeeCalculatorTest {
    @Test
    void chargesBaseRateInsideTheSameSpecialZone() {
        assertEquals(0.5, DeliveryFeeCalculator.calculate("Gastronomia", "Automotriz"));
    }

    @Test
    void chargesHighestRateBetweenSpecialZones() {
        assertEquals(1.5, DeliveryFeeCalculator.calculate("Automotriz", "Deportes"));
    }

    @Test
    void chargesIntermediateRateFromGeneralAreaToSpecialZone() {
        assertEquals(1.0, DeliveryFeeCalculator.calculate("Edificio Principal", "Deportes"));
    }

    @Test
    void handlesAccentsAndReferences() {
        assertEquals(1.5, DeliveryFeeCalculator.calculate(
                "Facultad de Gastronomía - bloque A",
                "Complejo de Deportes, cancha 2"
        ));
    }

    @Test
    void chargesBaseRateForGeneralLocations() {
        assertEquals(0.5, DeliveryFeeCalculator.calculate("Biblioteca", "Edificio Principal"));
    }
}
