package main

import (
	"fmt"
	"log"

	"github.com/attendance-system/internal/config"
	"github.com/attendance-system/internal/database"
	"github.com/attendance-system/internal/models"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to PostgreSQL
	db, err := database.Connect(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	var users []models.User
	if err := db.Find(&users).Error; err != nil {
		log.Fatalf("Failed to fetch users: %v", err)
	}

	var settings []models.Setting
	if err := db.Find(&settings).Error; err != nil {
		log.Printf("Failed to fetch settings: %v", err)
	}
	fmt.Println("--- Settings ---")
	for _, s := range settings {
		fmt.Printf("Key: %s | Value: %s\n", s.Key, s.Value)
	}

	fmt.Println("--- User Debug Info ---")
	for _, u := range users {
		fmt.Printf("Name: %-20s | ID: %-10s | Active: %-5v | FaceStatus: %s\n", u.Name, u.EmployeeID, u.IsActive, u.FaceVerificationStatus)
	}
	fmt.Println("-----------------------")
}
