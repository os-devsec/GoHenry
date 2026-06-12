package main

import (
	"fmt"
	"strings"
	"time"
)

var ecuadorLocation = time.FixedZone("America/Guayaquil", -5*60*60)

func normalizeDiscount(percent float64, startValue, endValue string) (float64, any, any, error) {
	if percent < 0 || percent > 100 {
		return 0, nil, nil, fmt.Errorf("el descuento debe ser un porcentaje entre 0 y 100")
	}
	if percent == 0 {
		return 0, nil, nil, nil
	}

	start := strings.TrimSpace(startValue)
	end := strings.TrimSpace(endValue)
	startTime, startError := time.Parse("15:04", start)
	endTime, endError := time.Parse("15:04", end)
	if startError != nil || endError != nil {
		return 0, nil, nil, fmt.Errorf("el horario de descuento debe incluir inicio y fin en formato HH:mm")
	}
	if !startTime.Before(endTime) {
		return 0, nil, nil, fmt.Errorf("la hora de inicio del descuento debe ser menor que la hora de fin")
	}
	return percent, start, end, nil
}

func discountActive(percent float64, startValue, endValue string, now time.Time) bool {
	if percent <= 0 {
		return false
	}
	start, startError := time.Parse("15:04", strings.TrimSpace(startValue))
	end, endError := time.Parse("15:04", strings.TrimSpace(endValue))
	if startError != nil || endError != nil || !start.Before(end) {
		return false
	}
	localNow := now.In(ecuadorLocation)
	currentMinutes := localNow.Hour()*60 + localNow.Minute()
	startMinutes := start.Hour()*60 + start.Minute()
	endMinutes := end.Hour()*60 + end.Minute()
	return currentMinutes >= startMinutes && currentMinutes < endMinutes
}
