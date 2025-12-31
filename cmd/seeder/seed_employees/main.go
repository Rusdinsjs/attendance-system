package main

import (
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/attendance-system/internal/config"
	"github.com/attendance-system/internal/database"
	"github.com/attendance-system/internal/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	firstNames = []string{
		"Budi", "Siti", "Agus", "Rina", "Dewi", "Eko", "Andi", "Sri", "Joko", "Yanti",
		"Putra", "Putri", "Rizky", "Nur", "Fajar", "Dian", "Hendra", "Ratna", "Bambang", "Wulan",
		"Adi", "Lina", "Dedi", "Eva", "Iwan", "Maya", "Rudi", "Tini", "Arief", "Rika",
		"Bayu", "Nita", "Doni", "Sari", "Hadi", "Yuli", "Reza", "Indah", "Ferry", "Vina",
	}
	lastNames = []string{
		"Santoso", "Wijaya", "Saputra", "Utami", "Hidayat", "Kusuma", "Pratama", "Lestari", "Permana", "Dewi",
		"Rahayu", "Wibowo", "Suryana", "Setiawan", "Purnomo", "Wati", "Yuliani", "Gunawan", "Susanti", "Nugroho",
		"Sari", "Maulana", "Fitriani", "Ramadhan", "Handayani", "Pradana", "Kurniawan", "Anggraeni", "Saputri", "Firmansyah",
		"Hasan", "Astuti", "Wahyudi", "Rahmawati", "Mustofa", "Haryanto", "Susilo", "Hartono", "Mulyadi", "Kusnadi",
	}
	positions = []string{"Software Engineer", "Frontend Developer", "Backend Developer", "Product Manager", "UI/UX Designer", "QA Engineer", "DevOps Engineer", "HR Specialist", "Sales Associate", "Marketing Specialist"}
	departments = []string{"Engineering", "Product", "Design", "Human Resources", "Sales", "Marketing"}
)

func main() {
	rand.Seed(time.Now().UnixNano())

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

	// Fetch Offices
	var offices []models.Office
	if err := db.Find(&offices).Error; err != nil {
		log.Fatalf("Failed to fetch offices: %v", err)
	}

	if len(offices) == 0 {
		log.Fatalf("No offices found. Please create an office first.")
	}

	log.Println("Cleaning up old dummy data...")
	db.Exec("DELETE FROM employees WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')")
	db.Exec("DELETE FROM users WHERE email LIKE '%@example.com'")

	log.Println("Starting employee generation...")

	counter := 0
	for i := 0; i < 100; i++ {
		// Generate random data
		firstName := firstNames[rand.Intn(len(firstNames))]
		lastName := lastNames[rand.Intn(len(lastNames))]
		fullName := fmt.Sprintf("%s %s", firstName, lastName)

		// Ensure uniqueness for NIK and EmployeeID simulation
		nikSuffix := rand.Intn(999999)
		nik := fmt.Sprintf("320%013d", nikSuffix) // Example 16 digit NIK
		employeeIDStr := fmt.Sprintf("E%04d%d", i+100, rand.Intn(99))

		// Email
		email := fmt.Sprintf("%s.%s%d@example.com", strings.ToLower(firstName), strings.ToLower(lastName), rand.Intn(1000))

		// Password: pass + NIK last 4 digits
		rawPassword := "pass" + nik[len(nik)-4:]
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Failed to hash password for %s: %v", fullName, err)
			continue
		}

		office := offices[rand.Intn(len(offices))]

		// Create User
		userID := uuid.New()
		user := models.User{
			ID:           userID,
			EmployeeID:   employeeIDStr,
			Name:         fullName,
			Email:        email,
			PasswordHash: string(hashedPassword),
			Role:         "employee",
			OfficeID:     &office.ID,
			OfficeLat:    office.Latitude,
			OfficeLong:   office.Longitude,
			AllowedRadius: 50,
			IsActive:     true,
			FaceVerificationStatus: "none",
		}

		// Save User
		if err := db.Create(&user).Error; err != nil {
			// Handle email uniqueness collision likely
			log.Printf("Failed to create user %s: %v", fullName, err)
			continue
		}

		// Create Employee
		birthDate := time.Now().AddDate(-20 - rand.Intn(30), -rand.Intn(12), -rand.Intn(28)) // 20-50 years old
		startDate := time.Now().AddDate(-rand.Intn(10), -rand.Intn(12), 0) // 0-10 years ago

		employee := models.Employee{
			UserID:           &userID,
			NIK:              nik,
			KTPNumber:        nik,
			Name:             fullName,
			PhotoURL:         fmt.Sprintf("https://ui-avatars.com/api/?name=%s&background=random", strings.ReplaceAll(fullName, " ", "+")),
			Gender:           []string{"L", "P"}[rand.Intn(2)],
			PlaceOfBirth:     "Jakarta",
			DateOfBirth:      birthDate,
			MaritalStatus:    []string{"LAJANG", "MENIKAH", "CERAI"}[rand.Intn(3)],
			ChildrenCount:    rand.Intn(4),
			Address:          "Jl. Sudirman No. " + fmt.Sprintf("%d", rand.Intn(100)),
			ResidenceStatus:  []string{"MILIK SENDIRI", "SEWA", "KOST"}[rand.Intn(3)],
			Religion:         "ISLAM",
			BloodType:        []string{"A", "B", "AB", "O"}[rand.Intn(4)],
			EmergencyContactName: "Ibu " + firstName,
			EmergencyContactPhone: fmt.Sprintf("0812%08d", rand.Intn(100000000)),
			EmergencyContactRelation: "Orang Tua",
			Position:         positions[rand.Intn(len(positions))],
			OfficeID:         office.ID,
			StartDate:        startDate,
			EmploymentStatus: []string{"PKWT", "PKWTT", "MAGANG"}[rand.Intn(3)],
			Education:        []string{"S1 Teknik Informatika", "S1 Sistem Informasi", "S1 Desain Komunikasi Visual"}[rand.Intn(3)],
			Grade:            fmt.Sprintf("Grade %d", rand.Intn(5)+1),
			BasicSalary:      float64(5000000 + rand.Intn(20) * 500000),
			BankAccount:      fmt.Sprintf("%d", 1000000000 + rand.Intn(1000000000)),
			BankName:         "BCA",
			BPJSKesehatan:    fmt.Sprintf("%d", 100000000 + rand.Intn(100000000)),
			BPJSTenagaKerja:  fmt.Sprintf("%d", 100000000 + rand.Intn(100000000)),
			NPWP:             fmt.Sprintf("%d", 100000000000000 + rand.Intn(100000000)),
			LeaveBalance:     12,
			LeaveUsed:        rand.Intn(5),
		}

		if err := db.Create(&employee).Error; err != nil {
			log.Printf("Failed to create employee record for %s: %v", fullName, err)
			
			// Rollback user if employee fails
			db.Delete(&user)
		} else {
			counter++
			if counter%10 == 0 {
				log.Printf("Created %d employees...", counter)
			}
		}
	}

	log.Printf("Successfully created %d employees with user accounts.", counter)
}
