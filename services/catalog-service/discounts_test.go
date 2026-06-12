package main

import (
	"testing"
	"time"
)

func TestDiscountActiveInsideRecurringWindow(t *testing.T) {
	now := time.Date(2026, time.June, 10, 15, 30, 0, 0, ecuadorLocation)
	if !discountActive(20, "14:00", "17:00", now) {
		t.Fatal("expected discount to be active inside the configured window")
	}
}

func TestDiscountInactiveOutsideRecurringWindow(t *testing.T) {
	now := time.Date(2026, time.June, 10, 18, 0, 0, 0, ecuadorLocation)
	if discountActive(20, "14:00", "17:00", now) {
		t.Fatal("expected discount to be inactive outside the configured window")
	}
}

func TestNormalizeDiscountRequiresValidWindow(t *testing.T) {
	if _, _, _, err := normalizeDiscount(20, "", ""); err == nil {
		t.Fatal("expected an error when a positive discount has no schedule")
	}
	if _, _, _, err := normalizeDiscount(20, "17:00", "14:00"); err == nil {
		t.Fatal("expected an error when the start is not before the end")
	}
}

func TestNormalizeZeroDiscountClearsSchedule(t *testing.T) {
	percent, start, end, err := normalizeDiscount(0, "14:00", "17:00")
	if err != nil || percent != 0 || start != nil || end != nil {
		t.Fatal("expected zero discount to clear its schedule")
	}
}
