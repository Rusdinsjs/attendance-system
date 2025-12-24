package utils

import (
	"math"
)

const earthRadiusKm = 6371.0 // Earth's radius in kilometers

// Haversine calculates the great-circle distance between two points
// on the Earth (specified in decimal degrees) using the Haversine formula.
// Returns distance in meters.
func Haversine(lat1, lon1, lat2, lon2 float64) float64 {
	// Convert degrees to radians
	lat1Rad := degreesToRadians(lat1)
	lat2Rad := degreesToRadians(lat2)
	deltaLat := degreesToRadians(lat2 - lat1)
	deltaLon := degreesToRadians(lon2 - lon1)

	// Haversine formula
	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(deltaLon/2)*math.Sin(deltaLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	// Distance in meters
	return earthRadiusKm * c * 1000
}

// IsWithinRadius checks if the given coordinates are within the specified radius (in meters)
// from the center point.
func IsWithinRadius(centerLat, centerLon, pointLat, pointLon float64, radiusMeters int) bool {
	distance := Haversine(centerLat, centerLon, pointLat, pointLon)
	return distance <= float64(radiusMeters)
}

// degreesToRadians converts degrees to radians
func degreesToRadians(deg float64) float64 {
	return deg * math.Pi / 180
}

// GetDistance returns the distance in meters between two coordinates
func GetDistance(lat1, lon1, lat2, lon2 float64) float64 {
	return Haversine(lat1, lon1, lat2, lon2)
}
