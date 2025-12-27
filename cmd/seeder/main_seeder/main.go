package main

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/attendance-system/internal/config"
	"github.com/attendance-system/internal/database"
	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/utils"
	"github.com/google/uuid"
)

var (
	officeNames = []string{"Head Office", "Branch South", "Branch North", "Tech Hub", "Sales Outpost"}
	positions   = []string{"Software Engineer", "HR Manager", "Sales Representative", "Accountant", "Office Admin"}
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

	log.Println("🚀 Starting Database Seeder...")

	// 1. Create Offices
	offices := make([]models.Office, 0)
	for i := 0; i < 5; i++ {
		office := models.Office{
			ID:        uuid.New(),
			Name:      officeNames[i],
			Address:   fmt.Sprintf("Jalan Jenderal Sudirman No. %d, Jakarta", i*10+1),
			Latitude:  -6.2088 + (rand.Float64()-0.5)*0.01,
			Longitude: 106.8456 + (rand.Float64()-0.5)*0.01,
			Radius:    50 + (i * 10), // int
			IsActive:  true,
		}
		if err := db.Create(&office).Error; err != nil {
			log.Printf("Failed to create office %s: %v", office.Name, err)
			continue // Skip if fails (e.g. duplicate)
		} else {
			offices = append(offices, office)
			log.Printf("✅ Created Office: %s", office.Name)
		}
	}

	if len(offices) == 0 {
		// Try fetching existing offices if creation failed (e.g. just seeding employees)
		db.Find(&offices)
		if len(offices) == 0 {
			log.Fatal("No offices available to link employees to. Aborting.")
		}
	}

	// 2. Create Kiosks
	for i := 0; i < 5; i++ {
		office := offices[i%len(offices)]
		kioskName := fmt.Sprintf("Kiosk %s - Gate %d", office.Name, i+1)
		kioskID := fmt.Sprintf("K%d-%s", i, uuid.New().String()[:8])
		
		kiosk := models.Kiosk{
			ID:       uuid.New(),
			KioskID:  kioskID,
			Name:     kioskName,
			OfficeID: office.ID,
			IsActive: true,
			LastSeen: time.Now(),
		}
		if err := db.Create(&kiosk).Error; err != nil {
			log.Printf("Error creating kiosk: %v", err)
		} else {
			log.Printf("✅ Created Kiosk: %s", kiosk.Name)
		}
	}

	// 3. Create Employees & Users
	hashedPassword, _ := utils.HashPassword("password123")
	
	for i := 1; i <= 10; i++ {
		office := offices[i%len(offices)]
		nik := fmt.Sprintf("DUMMY%03d", i) // Changed prefix to distinguish form other tests
		name := fmt.Sprintf("Employee %02d", i)
		
		employee := models.Employee{
			ID:               uuid.New(),
			NIK:              nik,
			KTPNumber:        fmt.Sprintf("31710%011d", i),
			Name:             name,
			Gender:           []string{"L", "P"}[rand.Intn(2)],
			PlaceOfBirth:     "Jakarta",
			DateOfBirth:      time.Date(1990+i, time.Month(i), i, 0, 0, 0, 0, time.UTC),
			MaritalStatus:    "LAJANG",
			ChildrenCount:    0,
			Address:          fmt.Sprintf("Jl. Resident %d", i),
			ResidenceStatus:  "RUMAH SENDIRI",
			Religion:         "ISLAM",
			BloodType:        "O",
			EmergencyContactName: "Emergency Contact",
			EmergencyContactPhone: "08123456789",
			EmergencyContactRelation: "SAUDARA",
			Position:         positions[i%len(positions)],
			OfficeID:         office.ID,
			StartDate:        time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			EmploymentStatus: "PKWTT",
			IsManager:        false,
			IsEvaluator:      false,
			Education:        "S1",
			Grade:            "1",
			BasicSalary:      5000000 + float64(i*100000),
			LeaveBalance:     12,
			LeaveUsed:        0,
			BPJSKesehatan:     fmt.Sprintf("0000%d", i),
			BPJSTenagaKerja:   fmt.Sprintf("1111%d", i),
			NPWP:              fmt.Sprintf("9999%d", i),
			BankName:          "BCA",
			BankAccount:       fmt.Sprintf("123456%d", i),
		}

		if err := db.Create(&employee).Error; err != nil {
			log.Printf("Error creating employee %s: %v", nik, err)
			continue
		}
		log.Printf("✅ Created Employee: %s", name)

		// Create User for Employee
		user := models.User{
			ID:           uuid.New(),
			EmployeeID:   nik,
			Name:         name,
			Email:        fmt.Sprintf("user.dummy%d@example.com", i),
			PasswordHash: hashedPassword,
			Role:         "employee",
			OfficeID:     &office.ID,
			IsActive:     true,
			OfficeLat:    office.Latitude,
			OfficeLong:   office.Longitude,
			AllowedRadius: office.Radius,
		}

		if err := db.Create(&user).Error; err != nil {
			log.Printf("Error creating user for %s: %v", nik, err)
		} else {
			// Link user back to employee
			db.Model(&employee).Update("user_id", user.ID)
			log.Printf("✅ Created User for: %s", name)
		}
	}

	log.Println("🎉 Database Seeding Completed!")
}
