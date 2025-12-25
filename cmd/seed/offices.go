package main

import (
	"context"
	"fmt"
	"log"

	"github.com/attendance-system/internal/config"
	"github.com/attendance-system/internal/database"
	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/repository"
)

func main() {
	// Initialize config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := database.Connect(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	officeRepo := repository.NewOfficeRepository(db)
	ctx := context.Background()

	// Check if any office exists
	offices, err := officeRepo.FindAll(ctx)
	if err != nil {
		log.Fatalf("Failed to check offices: %v", err)
	}

	if len(offices) > 0 {
		fmt.Printf("Office already exists: %s\n", offices[0].Name)
		return
	}

	// Create Main Office
	newOffice := &models.Office{
		Name:      "HQ Jakarta",
		Address:   "Jl. Jend. Sudirman No. 1",
		Latitude:  -6.2088,
		Longitude: 106.8456,
		Radius:    100,
		IsActive:  true,
	}

	if err := officeRepo.Create(ctx, newOffice); err != nil {
		log.Fatalf("Failed to create office: %v", err)
	}

	fmt.Printf("✅ Successfully seeded office: %s\n", newOffice.Name)
}
