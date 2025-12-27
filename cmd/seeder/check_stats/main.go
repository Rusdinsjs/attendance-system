package main

import (
	"log"
	"time"

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

	// Count Users
	var userCount int64
	db.Model(&models.User{}).Count(&userCount)
	log.Printf("Total Users in DB: %d", userCount)

	// Count Attendance Today
	today := time.Now().Format("2006-01-02")
	var attendanceCount int64
	db.Model(&models.Attendance{}).Where("DATE(check_in_time) = ?", today).Count(&attendanceCount)
	log.Printf("Total Attendance for %s: %d", today, attendanceCount)
	
	// Check random other day (yesterday)
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	var yesterdayCount int64
	db.Model(&models.Attendance{}).Where("DATE(check_in_time) = ?", yesterday).Count(&yesterdayCount)
	log.Printf("Total Attendance for %s: %d", yesterday, yesterdayCount)
}
