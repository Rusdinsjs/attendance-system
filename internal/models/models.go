package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// FaceEmbeddings is a custom type for storing face vectors
type FaceEmbeddings [][]float64

func (f FaceEmbeddings) Value() (driver.Value, error) {
	return json.Marshal(f)
}

func (f *FaceEmbeddings) Scan(value interface{}) error {
	if value == nil {
		*f = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, f)
}

// User represents an employee in the system
type User struct {
	ID                     uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	EmployeeID             string         `gorm:"uniqueIndex;not null" json:"employee_id"`
	Name                   string         `gorm:"not null" json:"name"`
	Email                  string         `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash           string         `gorm:"not null" json:"-"`
	Role                   string         `gorm:"default:employee" json:"role"`
	AvatarURL              string         `json:"avatar_url,omitempty"`
	FaceEmbeddings         FaceEmbeddings `gorm:"type:jsonb" json:"face_embeddings,omitempty"`
	FaceVerificationStatus string         `gorm:"default:none" json:"face_verification_status"`
	OfficeID               *uuid.UUID     `gorm:"type:uuid" json:"office_id,omitempty"`
	OfficeLat              float64        `gorm:"not null" json:"office_lat"`
	OfficeLong             float64        `gorm:"not null" json:"office_long"`
	AllowedRadius          int            `gorm:"default:50" json:"allowed_radius"`
	IsActive               bool           `gorm:"default:true" json:"is_active"`
	CreatedAt              time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt              time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	Attendances            []Attendance   `gorm:"foreignKey:UserID" json:"attendances,omitempty"`
	FacePhotos             []FacePhoto    `gorm:"foreignKey:UserID" json:"face_photos,omitempty"`
	Office                 *Office        `gorm:"foreignKey:OfficeID" json:"office,omitempty"`
}

// Attendance represents a check-in/check-out record
type Attendance struct {
	ID             uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID         uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	CheckInTime    *time.Time `json:"check_in_time"`
	CheckOutTime   *time.Time `json:"check_out_time,omitempty"`
	CheckInLat     *float64   `json:"check_in_lat,omitempty"`
	CheckInLong    *float64   `json:"check_in_long,omitempty"`
	CheckOutLat    *float64   `json:"check_out_lat,omitempty"`
	CheckOutLong   *float64   `json:"check_out_long,omitempty"`
	DeviceInfo     string     `json:"device_info,omitempty"`
	IsLate         bool       `gorm:"default:false" json:"is_late"`
	IsMockLocation bool       `gorm:"default:false" json:"is_mock_location"`
	Notes          string     `json:"notes,omitempty"`
	CreatedAt      time.Time  `gorm:"autoCreateTime" json:"created_at"`
	User           *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// RefreshToken stores JWT refresh tokens
type RefreshToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`
	Token     string    `gorm:"uniqueIndex;not null" json:"token"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	User      *User     `gorm:"foreignKey:UserID" json:"-"`
}

// Office represents a company office location
type Office struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	Address   string    `json:"address"`
	Latitude  float64   `gorm:"not null" json:"latitude"`
	Longitude float64   `gorm:"not null" json:"longitude"`
	Radius    int       `gorm:"default:50" json:"radius"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// FacePhoto represents a temporary face photo pending verification
type FacePhoto struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`
	PhotoPath  string    `gorm:"not null" json:"photo_path"`
	PhotoOrder int       `gorm:"not null" json:"photo_order"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
	User       *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// Setting represents a configurable system setting
type Setting struct {
	Key         string    `gorm:"primaryKey" json:"key"`
	Value       string    `gorm:"not null" json:"value"`
	Description string    `json:"description,omitempty"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// OfficeTransferRequest represents a request to change office location
type OfficeTransferRequest struct {
	ID                  uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID              uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`
	CurrentOfficeLat    float64   `gorm:"not null" json:"current_office_lat"`
	CurrentOfficeLong   float64   `gorm:"not null" json:"current_office_long"`
	RequestedOfficeLat  float64   `gorm:"not null" json:"requested_office_lat"`
	RequestedOfficeLong float64   `gorm:"not null" json:"requested_office_long"`
	RequestedRadius     int       `gorm:"default:50" json:"requested_radius"`
	Reason              string    `json:"reason,omitempty"`
	Status              string    `gorm:"default:pending" json:"status"`
	AdminNote           string    `json:"admin_note,omitempty"`
	CreatedAt           time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	User                *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName overrides for GORM
func (User) TableName() string                  { return "users" }
func (Attendance) TableName() string            { return "attendances" }
func (RefreshToken) TableName() string          { return "refresh_tokens" }
func (Office) TableName() string                { return "offices" }
func (FacePhoto) TableName() string             { return "face_photos" }
func (Setting) TableName() string               { return "settings" }
func (OfficeTransferRequest) TableName() string { return "office_transfer_requests" }
