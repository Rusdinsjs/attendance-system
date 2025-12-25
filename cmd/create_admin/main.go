package main

import (
	"log"

	"github.com/attendance-system/internal/config"
	"github.com/attendance-system/internal/database"
	"github.com/attendance-system/internal/models"
	"golang.org/x/crypto/bcrypt"
)

func main() {
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }

	db, err := database.Connect(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)

    var user models.User
    // Try to find by EmployeeID first
    if err := db.Where("employee_id = ?", "ADMIN001").First(&user).Error; err == nil {
        log.Println("Admin found by EmployeeID, updating...")
        user.Email = "admin@attendx.com"
        user.PasswordHash = string(hashedPassword)
        user.Role = "admin"
        if err := db.Save(&user).Error; err != nil {
            log.Fatalf("Failed to update admin: %v", err)
        }
    } else {
        // Not found by EmployeeID, try by Email
        if err := db.Where("email = ?", "admin@attendx.com").First(&user).Error; err == nil {
             log.Println("Admin found by Email, updating...")
             user.EmployeeID = "ADMIN001"
             user.PasswordHash = string(hashedPassword)
             user.Role = "admin"
             if err := db.Save(&user).Error; err != nil {
                log.Fatalf("Failed to update admin: %v", err)
            }
        } else {
            // Neither found, create new
            log.Println("Admin not found, creating...")
            admin := models.User{
                EmployeeID:    "ADMIN001",
                Name:          "System Admin",
                Email:         "admin@attendx.com",
                PasswordHash:  string(hashedPassword),
                Role:          "admin",
                IsActive:      true,
                AllowedRadius: 50,
                OfficeLat: -6.175110,
                OfficeLong: 106.865036,
            }
            if err := db.Create(&admin).Error; err != nil {
                log.Fatalf("Failed to create admin: %v", err)
            }
        }
    }
	log.Println("Admin user ensured successfully")
}
