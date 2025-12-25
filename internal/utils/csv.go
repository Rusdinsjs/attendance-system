package utils

import (
	"encoding/csv"
	"io"
)

// ParseCSV parses a CSV file from a reader
func ParseCSV(r io.Reader) ([][]string, error) {
	reader := csv.NewReader(r)
	return reader.ReadAll()
}
