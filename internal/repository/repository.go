package repository

import (
	"context"
	"time"

	"github.com/attendance-system/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserRepository handles database operations for users
type UserRepository struct {
	db *gorm.DB
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
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByEmail finds a user by email
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByEmployeeID finds a user by employee ID
func (r *UserRepository) FindByEmployeeID(ctx context.Context, employeeID string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).Where("employee_id = ?", employeeID).First(&user).Error
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

// GetAll returns all active users
func (r *UserRepository) GetAll(ctx context.Context) ([]models.User, error) {
	var users []models.User
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Find(&users).Error
	return users, err
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

// FindByFaceStatus finds users by face verification status
func (r *UserRepository) FindByFaceStatus(ctx context.Context, status string) ([]models.User, error) {
	var users []models.User
	err := r.db.WithContext(ctx).
		Where("face_verification_status = ?", status).
		Order("updated_at DESC").
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

// GetAllToday returns all attendance records for today (for admin dashboard)
func (r *AttendanceRepository) GetAllToday(ctx context.Context) ([]models.Attendance, error) {
	var attendances []models.Attendance
	today := time.Now().Format("2006-01-02")
	
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("DATE(check_in_time) = ?", today).
		Order("check_in_time DESC").
		Find(&attendances).Error
	
	return attendances, err
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

// FindByStatus finds all transfer requests by status
func (r *TransferRequestRepository) FindByStatus(ctx context.Context, status string) ([]models.OfficeTransferRequest, error) {
	var requests []models.OfficeTransferRequest
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("status = ?", status).
		Order("created_at DESC").
		Find(&requests).Error
	return requests, err
}

// Update updates a transfer request
func (r *TransferRequestRepository) Update(ctx context.Context, request *models.OfficeTransferRequest) error {
	return r.db.WithContext(ctx).Save(request).Error
}
