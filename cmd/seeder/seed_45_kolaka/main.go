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
	// Indonesian first names
	firstNamesMale = []string{
		"Ahmad", "Budi", "Cahyo", "Dedi", "Eko", "Fajar", "Gunawan", "Hendra", "Irwan", "Joko",
		"Kurniawan", "Lukman", "Maulana", "Nasir", "Oji", "Putra", "Qomar", "Rizky", "Sugeng", "Teguh",
		"Udin", "Vino", "Wahyu", "Yanto", "Zainal", "Arif", "Bambang", "Dimas", "Fauzi", "Gilang",
		"Hasan", "Imam", "Jefri", "Krisna", "Lutfi", "Mulyadi", "Nanda", "Octa", "Prasetyo", "Rudi",
	}
	firstNamesFemale = []string{
		"Ani", "Bunga", "Citra", "Dewi", "Eka", "Fitri", "Gita", "Hani", "Indah", "Julia",
		"Kartika", "Lina", "Maya", "Nur", "Oktavia", "Putri", "Qori", "Rina", "Siti", "Tari",
		"Ulfa", "Vina", "Wati", "Yani", "Zahra", "Ayu", "Bella", "Dian", "Evi", "Fatimah",
		"Gina", "Hesti", "Ika", "Jasmine", "Kiki", "Lestari", "Mira", "Nia", "Ocha", "Puspita",
	}
	lastNames = []string{
		"Saputra", "Wijaya", "Santoso", "Pratama", "Hidayat", "Kusuma", "Permana", "Setiawan", "Wibowo", "Suryana",
		"Lestari", "Rahayu", "Handayani", "Susanti", "Purnomo", "Nugroho", "Gunawan", "Yuliani", "Ramadhan", "Fitriani",
		"Maulana", "Sari", "Utami", "Dewi", "Haryanto", "Kurniawan", "Susilo", "Hartono", "Mulyadi", "Kusnadi",
		"Wahyudi", "Firmansyah", "Anggraeni", "Pradana", "Mustofa", "Astuti", "Rahmawati", "Hasan", "Abdullah", "Ibrahim",
	}

	// Birth places
	bigCities = []string{
		"Jakarta", "Surabaya", "Bandung", "Medan", "Makassar", "Semarang", "Palembang", "Tangerang", "Depok", "Bekasi",
	}
	sultraRegions = []string{"Kendari", "Unaaha", "Raha", "Buton"}

	// Residence places with addresses
	kolakaAddresses = []string{
		"Jl. Pemuda No.", "Jl. Merdeka No.", "Jl. Ahmad Yani No.", "Jl. Poros Kolaka No.", "Jl. Diponegoro No.",
		"Jl. Kartini No.", "Jl. Sudirman No.", "Jl. Gatot Subroto No.", "Jl. Pahlawan No.", "Jl. Nusantara No.",
	}
	kendariAddresses = []string{
		"Jl. MT Haryono No.", "Jl. Sao-Sao No.", "Jl. Malik Baelo No.", "Jl. Abd. Silondae No.", "Jl. Laute No.",
	}
	otherAddresses = []string{
		"Jl. Utama No.", "Jl. Raya No.", "Jl. Poros No.", "Jl. Desa No.", "Jl. Kampung No.",
	}

	positions = []string{
		"Staff Administrasi", "Staff Keuangan", "Staff HRD", "Staff IT", "Staff Marketing",
		"Supervisor", "Koordinator Lapangan", "Teknisi", "Driver", "Security",
		"Operator", "Customer Service", "Sales", "Accounting", "Warehouse Staff",
	}

	religions          = []string{"ISLAM", "KRISTEN", "KATOLIK", "HINDU", "BUDDHA"}
	bloodTypes         = []string{"A", "B", "AB", "O"}
	maritalStatuses    = []string{"LAJANG", "MENIKAH", "CERAI"}
	residenceStatuses  = []string{"RUMAH SENDIRI", "SEWA", "KOST", "IKUT ORANG TUA"}
	employmentStatuses = []string{"PKWT", "PKWTT", "MAGANG"}
	educations         = []string{"SMA/SMK", "D3", "S1", "S2"}
	grades             = []string{"Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"}
	banks              = []string{"BRI", "BNI", "Mandiri", "BCA", "Bank Sultra"}
)

func main() {
	rand.Seed(time.Now().UnixNano())

	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := database.Connect(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("🚀 Starting 45 Employees Seeder (Kolaka Edition)...")

	// Get offices
	var offices []models.Office
	if err := db.Find(&offices).Error; err != nil {
		log.Fatalf("Failed to fetch offices: %v", err)
	}
	if len(offices) == 0 {
		log.Fatal("No offices found. Please create an office first.")
	}

	// Default password
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("sjs123"), bcrypt.DefaultCost)

	counter := 0
	for i := 0; i < 45; i++ {
		// Gender (50/50)
		isMale := rand.Float64() < 0.5
		var firstName string
		var gender string
		if isMale {
			firstName = firstNamesMale[rand.Intn(len(firstNamesMale))]
			gender = "L"
		} else {
			firstName = firstNamesFemale[rand.Intn(len(firstNamesFemale))]
			gender = "P"
		}
		lastName := lastNames[rand.Intn(len(lastNames))]
		fullName := fmt.Sprintf("%s %s", firstName, lastName)

		// Birth place distribution: 30% big cities, 60% Kolaka, 10% Sultra regions
		var birthPlace string
		birthRoll := rand.Float64()
		if birthRoll < 0.30 {
			birthPlace = bigCities[rand.Intn(len(bigCities))]
		} else if birthRoll < 0.90 {
			birthPlace = "Kolaka"
		} else {
			birthPlace = sultraRegions[rand.Intn(len(sultraRegions))]
		}

		// Age: 18-54 years old
		age := 18 + rand.Intn(37) // 18 to 54
		birthYear := time.Now().Year() - age
		birthDate := time.Date(birthYear, time.Month(1+rand.Intn(12)), 1+rand.Intn(28), 0, 0, 0, 0, time.UTC)

		// Residence distribution: 75% Kolaka, 10% Kendari, 15% others
		var address string
		var city string
		residenceRoll := rand.Float64()
		if residenceRoll < 0.75 {
			city = "Kolaka"
			address = fmt.Sprintf("%s %d, Kolaka, Sulawesi Tenggara", kolakaAddresses[rand.Intn(len(kolakaAddresses))], 1+rand.Intn(100))
		} else if residenceRoll < 0.85 {
			city = "Kendari"
			address = fmt.Sprintf("%s %d, Kendari, Sulawesi Tenggara", kendariAddresses[rand.Intn(len(kendariAddresses))], 1+rand.Intn(100))
		} else {
			otherCities := []string{"Unaaha", "Wolo", "Bombana"}
			city = otherCities[rand.Intn(len(otherCities))]
			address = fmt.Sprintf("%s %d, %s, Sulawesi Tenggara", otherAddresses[rand.Intn(len(otherAddresses))], 1+rand.Intn(100), city)
		}

		// Generate unique identifiers
		nikSuffix := rand.Intn(999999999)
		nik := fmt.Sprintf("7405%012d", nikSuffix) // 7405 = Kode Kolaka
		employeeID := fmt.Sprintf("E%04d", 1000+i)
		email := fmt.Sprintf("%s.%s%d@sjs.com", strings.ToLower(firstName), strings.ToLower(lastName), rand.Intn(100))

		// Random other data
		religion := religions[rand.Intn(len(religions))]
		if rand.Float64() < 0.85 {
			religion = "ISLAM" // 85% Muslim
		}

		childrenCount := 0
		maritalStatus := maritalStatuses[rand.Intn(len(maritalStatuses))]
		if maritalStatus == "MENIKAH" {
			childrenCount = rand.Intn(5)
		}

		office := offices[rand.Intn(len(offices))]
		startYear := 2015 + rand.Intn(10) // Started between 2015-2024
		startDate := time.Date(startYear, time.Month(1+rand.Intn(12)), 1+rand.Intn(28), 0, 0, 0, 0, time.UTC)

		basicSalary := float64(3000000 + rand.Intn(12)*500000) // 3jt - 9jt

		// Create User
		userID := uuid.New()
		user := models.User{
			ID:                     userID,
			EmployeeID:             employeeID,
			Name:                   fullName,
			Email:                  email,
			PasswordHash:           string(hashedPassword),
			Role:                   "employee",
			OfficeID:               &office.ID,
			OfficeLat:              office.Latitude,
			OfficeLong:             office.Longitude,
			AllowedRadius:          office.Radius,
			IsActive:               true,
			FaceVerificationStatus: "none",
		}

		if err := db.Create(&user).Error; err != nil {
			log.Printf("Failed to create user %s: %v", fullName, err)
			continue
		}

		// Create Employee
		employee := models.Employee{
			UserID:                   &userID,
			NIK:                      nik,
			KTPNumber:                nik,
			Name:                     fullName,
			PhotoURL:                 fmt.Sprintf("https://ui-avatars.com/api/?name=%s&background=random&size=200", strings.ReplaceAll(fullName, " ", "+")),
			Gender:                   gender,
			PlaceOfBirth:             birthPlace,
			DateOfBirth:              birthDate,
			MaritalStatus:            maritalStatus,
			ChildrenCount:            childrenCount,
			Address:                  address,
			ResidenceStatus:          residenceStatuses[rand.Intn(len(residenceStatuses))],
			Religion:                 religion,
			BloodType:                bloodTypes[rand.Intn(len(bloodTypes))],
			EmergencyContactName:     fmt.Sprintf("Keluarga %s", lastName),
			EmergencyContactPhone:    fmt.Sprintf("0852%08d", rand.Intn(100000000)),
			EmergencyContactRelation: "Keluarga",
			Position:                 positions[rand.Intn(len(positions))],
			OfficeID:                 office.ID,
			StartDate:                startDate,
			EmploymentStatus:         employmentStatuses[rand.Intn(len(employmentStatuses))],
			Education:                educations[rand.Intn(len(educations))],
			Grade:                    grades[rand.Intn(len(grades))],
			BasicSalary:              basicSalary,
			BankAccount:              fmt.Sprintf("%d", 1000000000+rand.Intn(1000000000)),
			BankName:                 banks[rand.Intn(len(banks))],
			BPJSKesehatan:            fmt.Sprintf("%d", 100000000+rand.Intn(900000000)),
			BPJSTenagaKerja:          fmt.Sprintf("%d", 100000000+rand.Intn(900000000)),
			NPWP:                     fmt.Sprintf("%d.%d.%d.%d-%03d.000", rand.Intn(100), rand.Intn(1000), rand.Intn(1000), rand.Intn(10), rand.Intn(1000)),
			LeaveBalance:             12,
			LeaveUsed:                rand.Intn(5),
		}

		if err := db.Create(&employee).Error; err != nil {
			log.Printf("Failed to create employee %s: %v", fullName, err)
			db.Delete(&user) // Rollback user
			continue
		}

		counter++
		log.Printf("✅ [%d/45] Created: %s (Lahir: %s, Tinggal: %s)", counter, fullName, birthPlace, city)
	}

	log.Printf("🎉 Seeding completed! Total employees created: %d", counter)
}
