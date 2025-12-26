package main

import (
	"log"
	"math"
	"math/rand"
	"time"

	"github.com/attendance-system/internal/config"
	"github.com/attendance-system/internal/database"
	"github.com/attendance-system/internal/models"
	"github.com/google/uuid"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to DB
	db, err := database.Connect(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to db: %v", err)
	}

	// Clean slate
	log.Println("Clearing attendances...")
	db.Exec("DELETE FROM attendances")

	// Fetch Users
	var users []models.User
	if err := db.Find(&users).Error; err != nil {
		log.Fatalf("Failed to find users: %v", err)
	}

	if len(users) == 0 {
		log.Println("No users.")
		return
	}

	totalUsers := len(users)
	log.Printf("Generating for %d users...", totalUsers)

	// Timezone Config: WIB (UTC+7)
	wib := time.FixedZone("Asia/Jakarta", 7*60*60)
	
	// 'today' in WIB
	nowUTC := time.Now().UTC()
	today := nowUTC.In(wib)

	// Batches
	var batch []models.Attendance
	const BatchSize = 1000

	periods := []struct {
		Name       string
		StartDate  time.Time
		EndDate    time.Time
		TargetAvg  float64
	}{
		{ "Month 1", today.AddDate(0, 0, -90), today.AddDate(0, 0, -61), 0.975 },
		{ "Month 2", today.AddDate(0, 0, -60), today.AddDate(0, 0, -31), 0.983 },
		{ "Month 3", today.AddDate(0, 0, -30), today, 0.969 },
	}

	totalRecs := 0

	for _, p := range periods {
		log.Printf("Processing %s (Target %.1f%%)", p.Name, p.TargetAvg*100)
		
		for d := p.StartDate; !d.After(p.EndDate); d = d.AddDate(0, 0, 1) {
			if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
				continue
			}

			// Daily Rate
			noise := (rand.Float64() - 0.5) * 0.03
			dailyRate := p.TargetAvg + noise
			if dailyRate < 0.95 { dailyRate = 0.95 }
			if dailyRate > 1.00 { dailyRate = 1.00 }

			numPresent := int(math.Round(float64(totalUsers) * dailyRate))
			if numPresent > totalUsers { numPresent = totalUsers }
			
			// Shuffle
			shuffled := make([]models.User, len(users))
			copy(shuffled, users)
			rand.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
			
			presentUsers := shuffled[:numPresent]

			// Late logic (~5%)
			lateRate := 0.05 + ((rand.Float64() - 0.5) * 0.02)
			numLate := int(math.Round(float64(numPresent) * lateRate))
			
			rand.Shuffle(len(presentUsers), func(i, j int) { presentUsers[i], presentUsers[j] = presentUsers[j], presentUsers[i] })
			
			lateUsers := presentUsers[:numLate]
			onTimeUsers := presentUsers[numLate:]

			for _, u := range lateUsers {
				att := newAttendance(u, d, true, wib)
				if att != nil { batch = append(batch, *att) }
			}
			for _, u := range onTimeUsers {
				att := newAttendance(u, d, false, wib)
				if att != nil { batch = append(batch, *att) }
			}

			if len(batch) >= BatchSize {
				if err := db.CreateInBatches(batch, BatchSize).Error; err != nil {
					log.Printf("Failed batch: %v", err)
				}
				totalRecs += len(batch)
				batch = nil
			}
		}
	}

	if len(batch) > 0 {
		db.CreateInBatches(batch, len(batch))
		totalRecs += len(batch)
	}

	log.Printf("Finished. Total Records: %d", totalRecs)
}

func newAttendance(user models.User, date time.Time, isLate bool, loc *time.Location) *models.Attendance {
	// Reconstruct 'checkIn' strictly in 'loc' timezone (WIB)
	// Base date is 'date' (which is derived from 'today' which is in 'loc')
	
	var h, m int
	if isLate {
		h = 8
		m = 1 + rand.Intn(89)
		if m >= 60 { h = 9; m -= 60 }
	} else {
		h = 7
		m = 30 + rand.Intn(31) 
		if m >= 60 { h = 8; m = 0 }
	}
	
	checkIn := time.Date(date.Year(), date.Month(), date.Day(), h, m, rand.Intn(60), 0, loc)
	
	coH := 17 + rand.Intn(3)
	checkOut := time.Date(date.Year(), date.Month(), date.Day(), coH, rand.Intn(60), rand.Intn(60), 0, loc)

	var pCheckOut *time.Time
	
	// Future check logic using UTC comparison
	now := time.Now().In(loc)
	
	// If checkIn is future (tomorrow relative to run time, or literally future time today)
	if checkIn.After(now) {
		return nil
	}
	
	// Is it Today? Check YearDay
	if date.Year() == now.Year() && date.YearDay() == now.YearDay() {
		if checkOut.After(now) {
			pCheckOut = nil
		} else {
			pCheckOut = &checkOut
		}
	} else {
		pCheckOut = &checkOut
	}

	lat := -6.2088 + (rand.Float64()-0.5)*0.01
	long := 106.8456 + (rand.Float64()-0.5)*0.01

	return &models.Attendance{
		ID: uuid.New(),
		UserID: user.ID,
		CheckInTime: &checkIn,
		CheckOutTime: pCheckOut,
		CheckInLat: &lat,
		CheckInLong: &long,
		CheckOutLat: &lat,
		CheckOutLong: &long,
		IsLate: isLate,
		DeviceInfo: "Seeder WIB",
	}
}
