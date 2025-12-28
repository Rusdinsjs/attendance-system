package utils

import (
	"time"
)

const (
	StatusOnTime         = "Tepat Waktu"
	StatusLate           = "Terlambat"
	StatusEarlyDeparture = "Cepat Pulang"
)

// DetermineCheckInStatus determines if a check-in is late
// checkInTime: The actual check-in time
// scheduleStr: The scheduled check-in time (e.g., "08:00")
// tolerance: Tolerance in minutes
func DetermineCheckInStatus(checkInTime time.Time, scheduleStr string, tolerance int) string {
	if scheduleStr == "" {
		scheduleStr = "08:00" // Fallback default
	}

	schedule, err := parseTimeOnDate(checkInTime, scheduleStr)
	if err != nil {
		return StatusOnTime // Fail safe
	}

	limit := schedule.Add(time.Duration(tolerance) * time.Minute)

	if checkInTime.After(limit) {
		return StatusLate
	}
	return StatusOnTime
}

// DetermineCheckOutStatus determines if a check-out is early
// checkOutTime: The actual check-out time
// scheduleStr: The scheduled check-out time (e.g., "17:00")
// tolerance: Tolerance in minutes
func DetermineCheckOutStatus(checkOutTime time.Time, scheduleStr string, tolerance int) string {
	if scheduleStr == "" {
		scheduleStr = "17:00" // Fallback default
	}

	schedule, err := parseTimeOnDate(checkOutTime, scheduleStr)
	if err != nil {
		return StatusOnTime // Fail safe
	}

	limit := schedule.Add(time.Duration(-tolerance) * time.Minute)

	if checkOutTime.Before(limit) {
		return StatusEarlyDeparture
	}
	return StatusOnTime
}

// parseTimeOnDate creates a time.Time for a specific "HH:mm" on the same date as refTime
func parseTimeOnDate(refTime time.Time, timeStr string) (time.Time, error) {
	parsed, err := time.Parse("15:04", timeStr)
	if err != nil {
		return time.Time{}, err
	}

	return time.Date(
		refTime.Year(), refTime.Month(), refTime.Day(),
		parsed.Hour(), parsed.Minute(), 0, 0,
		refTime.Location(),
	), nil
}
