package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/attendance-system/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserRepository handles database operations for users
type UserRepository struct {
	db *gorm.DB
}

// UserFilters contains filter criteria for users
type UserFilters struct {
	Name                   string
	Email                  string
	Role                   string
	OfficeID               string
	IsActive               *bool
	Position               string
	Gender                 string
	EmploymentStatus       string
	FaceVerificationStatus string
	DynamicFilters         []DynamicFilter
	SortBy                 string
	SortOrder              string // "asc" or "desc"
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create creates a new user
func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// FindByID finds a user by ID
func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	// Preload Office AND Employee.Office to handle data discrepancy
	err := r.db.WithContext(ctx).
		Preload("Office").
		Preload("Employee.Office").
		Where("id = ?", id).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByEmail finds a user by email
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).Preload("Office").Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByEmployeeID finds a user by employee ID
func (r *UserRepository) FindByEmployeeID(ctx context.Context, employeeID string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).Preload("Office").Where("employee_id = ?", employeeID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// Update updates a user
func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// UpdateFaceEmbeddings updates user's face embeddings
func (r *UserRepository) UpdateFaceEmbeddings(ctx context.Context, userID uuid.UUID, embeddings models.FaceEmbeddings) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Update("face_embeddings", embeddings).Error
}

// GetAll returns all active users (simple version)
func (r *UserRepository) GetAll(ctx context.Context) ([]models.User, error) {
	var users []models.User
	err := r.db.WithContext(ctx).Preload("Office").Where("is_active = ?", true).Find(&users).Error
	return users, err
}

// FindAll returns users with optional filtering and pagination
func (r *UserRepository) FindAll(ctx context.Context, filters UserFilters, limit, offset int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	query := r.db.WithContext(ctx).Model(&models.User{}).Preload("Office")

	if filters.Name != "" {
		query = query.Where("name ILIKE ?", "%"+filters.Name+"%")
	}
	if filters.Email != "" {
		query = query.Where("email ILIKE ?", "%"+filters.Email+"%")
	}
	if filters.Role != "" {
		query = query.Where("role = ?", filters.Role)
	}
	if filters.OfficeID != "" {
		query = query.Where("office_id = ?", filters.OfficeID)
	}
	if filters.IsActive != nil {
		query = query.Where("users.is_active = ?", *filters.IsActive)
	}
	if filters.FaceVerificationStatus != "" {
		query = query.Where("users.face_verification_status = ?", filters.FaceVerificationStatus)
	}

	// Join with Employees for extra filters
	if filters.Position != "" || filters.Gender != "" || filters.EmploymentStatus != "" {
		query = query.Joins("LEFT JOIN employees ON employees.user_id = users.id")

		if filters.Position != "" {
			query = query.Where("employees.position ILIKE ?", "%"+filters.Position+"%")
		}
		if filters.Gender != "" {
			query = query.Where("employees.gender = ?", filters.Gender)
		}
		if filters.EmploymentStatus != "" {
			query = query.Where("employees.employment_status = ?", filters.EmploymentStatus)
		}
	}

	// Dynamic Filters
	for _, f := range filters.DynamicFilters {
		switch f.Operator {
		case "eq":
			query = query.Where(fmt.Sprintf("%s = ?", f.Field), f.Value)
		case "neq":
			query = query.Where(fmt.Sprintf("%s != ?", f.Field), f.Value)
		case "like":
			query = query.Where(fmt.Sprintf("%s ILIKE ?", f.Field), "%"+f.Value+"%")
		case "gt":
			query = query.Where(fmt.Sprintf("%s > ?", f.Field), f.Value)
		case "lt":
			query = query.Where(fmt.Sprintf("%s < ?", f.Field), f.Value)
		}
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Sorting
	orderBy := "users.created_at"
	orderDir := "DESC"

	sortMap := map[string]string{
		"name":                     "users.name",
		"email":                    "users.email",
		"employee_id":              "users.employee_id",
		"role":                     "users.role",
		"is_active":                "users.is_active",
		"face_verification_status": "users.face_verification_status",
		"created_at":               "users.created_at",
	}

	if filters.SortBy != "" {
		if val, ok := sortMap[filters.SortBy]; ok {
			orderBy = val
		}
	}

	if filters.SortOrder == "asc" || filters.SortOrder == "ASC" {
		orderDir = "ASC"
	}

	err := query.Order(fmt.Sprintf("%s %s", orderBy, orderDir)).Limit(limit).Offset(offset).Find(&users).Error
	return users, total, err
}

// UpdatePasswordHash updates user's password hash
func (r *UserRepository) UpdatePasswordHash(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Update("password_hash", passwordHash).Error
}

// Delete deletes a user
func (r *UserRepository) Delete(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.User{}, userID).Error
}

// FindByFaceStatus finds users by face verification status with pagination
func (r *UserRepository) FindByFaceStatus(ctx context.Context, status string, limit, offset int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	query := r.db.WithContext(ctx).Model(&models.User{}).
		Where("face_verification_status = ?", status)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("updated_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&users).Error
	return users, total, err
}

// FindEmployeesForRegistration finds users eligible for face registration
func (r *UserRepository) FindEmployeesForRegistration(ctx context.Context) ([]models.User, error) {
	var users []models.User
	err := r.db.WithContext(ctx).
		Where("is_active = ? AND face_verification_status IN ?", true, []string{"not_registered", "rejected", "none"}).
		Order("name ASC").
		Find(&users).Error
	return users, err
}

// FacePhotoRepository handles database operations for face photos
type FacePhotoRepository struct {
	db *gorm.DB
}

// NewFacePhotoRepository creates a new face photo repository
func NewFacePhotoRepository(db *gorm.DB) *FacePhotoRepository {
	return &FacePhotoRepository{db: db}
}

// Create creates a new face photo record
func (r *FacePhotoRepository) Create(ctx context.Context, photo *models.FacePhoto) error {
	return r.db.WithContext(ctx).Create(photo).Error
}

// FindByUserID gets all photos for a user
func (r *FacePhotoRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]models.FacePhoto, error) {
	var photos []models.FacePhoto
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("photo_order ASC").
		Find(&photos).Error
	return photos, err
}

// DeleteByUserID deletes all photos for a user
func (r *FacePhotoRepository) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&models.FacePhoto{}).Error
}

// AttendanceFilters contains filter criteria for attendance reports
type AttendanceFilters struct {
	StartDate string
	EndDate   string
	Position  string
	OfficeID  string
	Status    string // "late", "on_time"
	SortBy    string
	SortOrder string // "ASC", "DESC"
}

// AttendanceRepository handles database operations for attendance
type AttendanceRepository struct {
	db *gorm.DB
}

// NewAttendanceRepository creates a new attendance repository
func NewAttendanceRepository(db *gorm.DB) *AttendanceRepository {
	return &AttendanceRepository{db: db}
}

// Create creates a new attendance record
func (r *AttendanceRepository) Create(ctx context.Context, attendance *models.Attendance) error {
	return r.db.WithContext(ctx).Create(attendance).Error
}

// FindByID finds an attendance by ID
func (r *AttendanceRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Attendance, error) {
	var attendance models.Attendance
	err := r.db.WithContext(ctx).Preload("User").Where("id = ?", id).First(&attendance).Error
	if err != nil {
		return nil, err
	}
	return &attendance, nil
}

// FindTodayByUserID finds today's attendance for a user
func (r *AttendanceRepository) FindTodayByUserID(ctx context.Context, userID uuid.UUID) (*models.Attendance, error) {
	var attendance models.Attendance
	today := time.Now().Format("2006-01-02")

	err := r.db.WithContext(ctx).
		Where("user_id = ? AND DATE(check_in_time) = ?", userID, today).
		First(&attendance).Error

	if err != nil {
		return nil, err
	}
	return &attendance, nil
}

// FindByUserAndDate finds attendance for a user on a specific date (format: 2006-01-02)
func (r *AttendanceRepository) FindByUserAndDate(ctx context.Context, userID uuid.UUID, date string) (*models.Attendance, error) {
	var attendance models.Attendance
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND DATE(check_in_time) = ?", userID, date).
		First(&attendance).Error
	if err != nil {
		return nil, err
	}
	return &attendance, nil
}

// Update updates an attendance record
func (r *AttendanceRepository) Update(ctx context.Context, attendance *models.Attendance) error {
	return r.db.WithContext(ctx).Save(attendance).Error
}

// GetHistory returns attendance history for a user
func (r *AttendanceRepository) GetHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.Attendance, error) {
	var attendances []models.Attendance
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("check_in_time DESC").
		Limit(limit).
		Offset(offset).
		Find(&attendances).Error
	return attendances, err
}

// FindAll returns attendance records with advanced filters and sorting
func (r *AttendanceRepository) FindAll(ctx context.Context, filters AttendanceFilters, limit, offset int) ([]models.Attendance, int64, error) {
	var attendances []models.Attendance
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Attendance{}).
		Preload("User").
		Preload("User.Office").   // Preload Office for User
		Preload("User.Employee"). // Preload Employee for User
		Joins("JOIN users ON users.id = attendances.user_id").
		Joins("LEFT JOIN employees ON employees.user_id = users.id") // Join employees for position

	// Date Range Filter
	if filters.StartDate != "" && filters.EndDate != "" {
		query = query.Where("DATE(attendances.check_in_time) BETWEEN ? AND ?", filters.StartDate, filters.EndDate)
	} else {
		// Default to today if no date provided? Or all?
		// Previous logic defaulted to Today. Let's keep that default if completely empty,
		// but usually reports module sends dates.
		if filters.StartDate == "" && filters.EndDate == "" {
			today := time.Now().Format("2006-01-02")
			query = query.Where("DATE(attendances.check_in_time) = ?", today)
		}
	}

	// Position Filter
	if filters.Position != "" {
		query = query.Where("employees.position ILIKE ?", "%"+filters.Position+"%")
	}

	// Office Location Filter (using OfficeID from User link)
	if filters.OfficeID != "" {
		query = query.Where("users.office_id = ?", filters.OfficeID)
	}

	// Status Filter (Late vs On Time)
	if filters.Status != "" {
		if filters.Status == "late" {
			query = query.Where("attendances.is_late = ?", true)
		} else if filters.Status == "on_time" {
			query = query.Where("attendances.is_late = ?", false)
		}
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Sorting
	sortMap := map[string]string{
		"check_in_time": "attendances.check_in_time",
		"name":          "users.name",
		"position":      "employees.position",
		"office":        "users.office_id", // Sorting by ID is weird, maybe join office name?
		// For now simple field mapping
	}

	orderBy := "attendances.check_in_time" // Default
	orderDir := "DESC"

	if filters.SortBy != "" {
		if val, ok := sortMap[filters.SortBy]; ok {
			orderBy = val
		} else {
			// Fallback or allowed explicit columns
			orderBy = filters.SortBy
		}
	}

	if filters.SortOrder == "ASC" || filters.SortOrder == "asc" {
		orderDir = "ASC"
	}

	// Special case for office name sorting if needed, requires another Join if not already preloaded
	// (GORM Preload doesn't join for sorting).
	// We joined Users. We would need to join Offices to sort by Office Name.
	// Assume OfficeID sort for now or client handles mapping.

	err := query.Order(fmt.Sprintf("%s %s", orderBy, orderDir)).
		Limit(limit).
		Offset(offset).
		Find(&attendances).Error

	return attendances, total, err
}

// ReportStats contains attendance report statistics
type ReportStats struct {
	TotalPresent    int64 `json:"total_present"`
	TotalOnTime     int64 `json:"total_on_time"`
	TotalLate       int64 `json:"total_late"`
	TotalEarlyLeave int64 `json:"total_early_leave"`
}

// GetReportStats calculates attendance statistics based on filters
func (r *AttendanceRepository) GetReportStats(ctx context.Context, filters AttendanceFilters) (*ReportStats, error) {
	stats := &ReportStats{}

	// Base Query Construction (Similar to FindAll but no pagination/sort/status)
	query := r.db.WithContext(ctx).Model(&models.Attendance{}).
		Joins("JOIN users ON users.id = attendances.user_id").
		Joins("LEFT JOIN employees ON employees.user_id = users.id")

	// Date Range Filter
	if filters.StartDate != "" && filters.EndDate != "" {
		query = query.Where("DATE(attendances.check_in_time) BETWEEN ? AND ?", filters.StartDate, filters.EndDate)
	} else {
		if filters.StartDate == "" && filters.EndDate == "" {
			today := time.Now().Format("2006-01-02")
			query = query.Where("DATE(attendances.check_in_time) = ?", today)
		}
	}

	// Position Filter
	if filters.Position != "" {
		query = query.Where("employees.position ILIKE ?", "%"+filters.Position+"%")
	}

	// Office Location Filter
	if filters.OfficeID != "" {
		query = query.Where("users.office_id = ?", filters.OfficeID)
	}

	// Count Total Present (all check-ins)
	if err := query.Session(&gorm.Session{}).Count(&stats.TotalPresent).Error; err != nil {
		return nil, err
	}

	// Count Late (check_in_status = 'Terlambat')
	if err := query.Session(&gorm.Session{}).Where("attendances.check_in_status = ?", "Terlambat").Count(&stats.TotalLate).Error; err != nil {
		return nil, err
	}

	// Count On Time (check_in_status = 'Tepat Waktu')
	if err := query.Session(&gorm.Session{}).Where("attendances.check_in_status = ?", "Tepat Waktu").Count(&stats.TotalOnTime).Error; err != nil {
		return nil, err
	}

	// Count Early Leave (check_out_status = 'Cepat Pulang')
	if err := query.Session(&gorm.Session{}).Where("attendances.check_out_status = ?", "Cepat Pulang").Count(&stats.TotalEarlyLeave).Error; err != nil {
		return nil, err
	}

	return stats, nil
}

// DailyStat represents daily attendance statistics
type DailyStat struct {
	Date    string `json:"date"`
	Total   int64  `json:"total"`
	Present int64  `json:"present"`
	Late    int64  `json:"late"`
}

// HourlyStat represents hourly attendance statistics
type HourlyStat struct {
	Hour    string `json:"hour"`
	Total   int64  `json:"total"`
	Present int64  `json:"present"`
	Late    int64  `json:"late"`
}

// GetDailyStats returns daily attendance statistics for a given period
func (r *AttendanceRepository) GetDailyStats(ctx context.Context, startTime, endTime time.Time) ([]DailyStat, error) {
	var stats []DailyStat

	err := r.db.WithContext(ctx).Model(&models.Attendance{}).
		Joins("JOIN users ON users.id = attendances.user_id").
		Select("TO_CHAR(check_in_time, 'YYYY-MM-DD') as date, COUNT(*) as total, "+
			"SUM(CASE WHEN is_late = false THEN 1 ELSE 0 END) as present, "+
			"SUM(CASE WHEN is_late = true THEN 1 ELSE 0 END) as late").
		Where("check_in_time BETWEEN ? AND ?", startTime, endTime).
		Group("TO_CHAR(check_in_time, 'YYYY-MM-DD')").
		Order("date ASC").
		Scan(&stats).Error

	return stats, err
}

// GetHourlyStats returns hourly attendance statistics for a given period
func (r *AttendanceRepository) GetHourlyStats(ctx context.Context, startTime, endTime time.Time) ([]HourlyStat, error) {
	var stats []HourlyStat

	// Group by H (Hour 0-23)
	// TO_CHAR(check_in_time, 'HH24:00') returns like "09:00", "14:00"
	err := r.db.WithContext(ctx).Model(&models.Attendance{}).
		Select("TO_CHAR(check_in_time, 'HH24:00') as hour, COUNT(*) as total, "+
			"SUM(CASE WHEN is_late = false THEN 1 ELSE 0 END) as present, "+
			"SUM(CASE WHEN is_late = true THEN 1 ELSE 0 END) as late").
		Where("check_in_time BETWEEN ? AND ?", startTime, endTime).
		Group("TO_CHAR(check_in_time, 'HH24:00')").
		Order("hour ASC").
		Scan(&stats).Error

	return stats, err
}

// RefreshTokenRepository handles database operations for refresh tokens
type RefreshTokenRepository struct {
	db *gorm.DB
}

// NewRefreshTokenRepository creates a new refresh token repository
func NewRefreshTokenRepository(db *gorm.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

// Create creates a new refresh token
func (r *RefreshTokenRepository) Create(ctx context.Context, token *models.RefreshToken) error {
	return r.db.WithContext(ctx).Create(token).Error
}

// FindByToken finds a refresh token by token string
func (r *RefreshTokenRepository) FindByToken(ctx context.Context, token string) (*models.RefreshToken, error) {
	var refreshToken models.RefreshToken
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("token = ? AND expires_at > ?", token, time.Now()).
		First(&refreshToken).Error
	if err != nil {
		return nil, err
	}
	return &refreshToken, nil
}

// DeleteByToken deletes a refresh token
func (r *RefreshTokenRepository) DeleteByToken(ctx context.Context, token string) error {
	return r.db.WithContext(ctx).Where("token = ?", token).Delete(&models.RefreshToken{}).Error
}

// DeleteByUserID deletes all refresh tokens for a user
func (r *RefreshTokenRepository) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&models.RefreshToken{}).Error
}

// CleanupExpired removes expired refresh tokens
func (r *RefreshTokenRepository) CleanupExpired(ctx context.Context) error {
	return r.db.WithContext(ctx).Where("expires_at < ?", time.Now()).Delete(&models.RefreshToken{}).Error
}

// SettingsRepository handles database operations for settings
type SettingsRepository struct {
	db *gorm.DB
}

// NewSettingsRepository creates a new settings repository
func NewSettingsRepository(db *gorm.DB) *SettingsRepository {
	return &SettingsRepository{db: db}
}

// GetAll returns all settings
func (r *SettingsRepository) GetAll(ctx context.Context) ([]models.Setting, error) {
	var settings []models.Setting
	err := r.db.WithContext(ctx).Find(&settings).Error
	return settings, err
}

// GetByKey returns a setting by key
func (r *SettingsRepository) GetByKey(ctx context.Context, key string) (*models.Setting, error) {
	var setting models.Setting
	err := r.db.WithContext(ctx).Where("key = ?", key).First(&setting).Error
	if err != nil {
		return nil, err
	}
	return &setting, nil
}

// Upsert creates or updates a setting
func (r *SettingsRepository) Upsert(ctx context.Context, setting *models.Setting) error {
	return r.db.WithContext(ctx).Save(setting).Error
}

// TransferRequestRepository handles database operations for transfer requests
type TransferRequestRepository struct {
	db *gorm.DB
}

// NewTransferRequestRepository creates a new transfer request repository
func NewTransferRequestRepository(db *gorm.DB) *TransferRequestRepository {
	return &TransferRequestRepository{db: db}
}

// Create creates a new transfer request
func (r *TransferRequestRepository) Create(ctx context.Context, request *models.OfficeTransferRequest) error {
	return r.db.WithContext(ctx).Create(request).Error
}

// FindByID finds a transfer request by ID
func (r *TransferRequestRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.OfficeTransferRequest, error) {
	var request models.OfficeTransferRequest
	err := r.db.WithContext(ctx).Preload("User").Where("id = ?", id).First(&request).Error
	if err != nil {
		return nil, err
	}
	return &request, nil
}

// FindByUserID finds all transfer requests for a user
func (r *TransferRequestRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]models.OfficeTransferRequest, error) {
	var requests []models.OfficeTransferRequest
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&requests).Error
	return requests, err
}

// FindPendingByUserID finds pending transfer request for a user
func (r *TransferRequestRepository) FindPendingByUserID(ctx context.Context, userID uuid.UUID) (*models.OfficeTransferRequest, error) {
	var request models.OfficeTransferRequest
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND status = ?", userID, "pending").
		First(&request).Error
	if err != nil {
		return nil, err
	}
	return &request, nil
}

// FindByStatus finds transfer requests by status with pagination
func (r *TransferRequestRepository) FindByStatus(ctx context.Context, status string, limit, offset int) ([]models.OfficeTransferRequest, int64, error) {
	var requests []models.OfficeTransferRequest
	var total int64

	query := r.db.WithContext(ctx).Model(&models.OfficeTransferRequest{}).
		Preload("User").
		Where("status = ?", status)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&requests).Error
	return requests, total, err
}

// Update updates a transfer request
func (r *TransferRequestRepository) Update(ctx context.Context, request *models.OfficeTransferRequest) error {
	return r.db.WithContext(ctx).Save(request).Error
}

// KioskRepository handles database operations for kiosks
type KioskRepository struct {
	db *gorm.DB
}

// NewKioskRepository creates a new kiosk repository
func NewKioskRepository(db *gorm.DB) *KioskRepository {
	return &KioskRepository{db: db}
}

// Create creates a new kiosk
func (r *KioskRepository) Create(ctx context.Context, kiosk *models.Kiosk) error {
	return r.db.WithContext(ctx).Create(kiosk).Error
}

// FindByKioskID finds a kiosk by its unique ID
func (r *KioskRepository) FindByKioskID(ctx context.Context, kioskID string) (*models.Kiosk, error) {
	var kiosk models.Kiosk
	err := r.db.WithContext(ctx).Where("kiosk_id = ?", kioskID).First(&kiosk).Error
	if err != nil {
		return nil, err
	}
	return &kiosk, nil
}

// UpdateLastSeen updates the last seen time of a kiosk
func (r *KioskRepository) UpdateLastSeen(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&models.Kiosk{}).Where("id = ?", id).Update("last_seen", time.Now()).Error
}

// GetAll returns kiosks with pagination
func (r *KioskRepository) GetAll(ctx context.Context, limit, offset int) ([]models.Kiosk, int64, error) {
	var kiosks []models.Kiosk
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Kiosk{}).Preload("Office")

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&kiosks).Error
	return kiosks, total, err
}

// Update updates a kiosk
func (r *KioskRepository) Update(ctx context.Context, kiosk *models.Kiosk) error {
	return r.db.WithContext(ctx).Save(kiosk).Error
}

// Delete deletes a kiosk
func (r *KioskRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Kiosk{}, id).Error
}
func (r *KioskRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Kiosk, error) {
	var kiosk models.Kiosk
	err := r.db.WithContext(ctx).Preload("Office").First(&kiosk, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &kiosk, nil
}

// FindAvailable returns all kiosks that are not paired yet
func (r *KioskRepository) FindAvailable(ctx context.Context) ([]models.Kiosk, error) {
	kiosks := []models.Kiosk{}
	err := r.db.WithContext(ctx).Where("is_paired = ? AND is_active = ?", false, true).Preload("Office").Find(&kiosks).Error
	return kiosks, err
}
