package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/attendance-system/internal/config"
	"github.com/attendance-system/internal/database"
	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/repository"
)

func main() {
	// Initialize config
	cfg, err := config.Load() // Changed from LoadConfig to Load
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := database.Connect(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Run migrations
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	kioskRepo := repository.NewKioskRepository(db)
	officeRepo := repository.NewOfficeRepository(db)

	ctx := context.Background()

	// Get the first office to link the kiosk to
	offices, err := officeRepo.FindAll(ctx)
	if err != nil {
		log.Fatalf("Failed to get offices: %v", err)
	}

	if len(offices) == 0 {
		log.Fatal("No offices found. Please create an office first.")
	}

	// Seed Kiosk
	kioskID := "KIOSK-HQ-01"
	existing, _ := kioskRepo.FindByKioskID(ctx, kioskID)
	if existing != nil {
		fmt.Printf("Kiosk %s already exists\n", kioskID)
		return
	}

	newKiosk := &models.Kiosk{
		KioskID:   kioskID,
		Name:      "Main Entrance Kiosk",
		OfficeID:  offices[0].ID,
		IsActive:  true,
		LastSeen:  time.Now(),
	}

	if err := kioskRepo.Create(ctx, newKiosk); err != nil {
		log.Fatalf("Failed to create kiosk: %v", err)
	}

	fmt.Printf("✅ Successfully seeded kiosk: %s (Office: %s)\n", newKiosk.KioskID, offices[0].Name)
}
