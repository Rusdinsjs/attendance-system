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
	Employee               *Employee      `gorm:"foreignKey:UserID" json:"employee,omitempty"`
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

// Kiosk represents a registered kiosk device
type Kiosk struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	KioskID   string    `gorm:"uniqueIndex;not null" json:"kiosk_id"`
	Name      string    `gorm:"not null" json:"name"`
	OfficeID  uuid.UUID `gorm:"type:uuid;not null" json:"office_id"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	IsPaired  bool      `gorm:"default:false" json:"is_paired"`
	LastSeen  time.Time `json:"last_seen"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	Office    *Office   `gorm:"foreignKey:OfficeID" json:"office,omitempty"`
}

// TableName overrides for GORM
func (User) TableName() string                  { return "users" }
func (Attendance) TableName() string            { return "attendances" }
func (RefreshToken) TableName() string          { return "refresh_tokens" }
func (Office) TableName() string                { return "offices" }
func (FacePhoto) TableName() string             { return "face_photos" }
func (Setting) TableName() string               { return "settings" }
func (OfficeTransferRequest) TableName() string { return "office_transfer_requests" }
func (Kiosk) TableName() string                 { return "kiosks" }
func (Employee) TableName() string              { return "employees" }
func (WorkExperience) TableName() string        { return "work_experiences" }
func (EmployeeEvaluation) TableName() string    { return "employee_evaluations" }

// JSONStringArray is a helper for storing []string as JSONB
type JSONStringArray []string

func (a JSONStringArray) Value() (driver.Value, error) {
	if len(a) == 0 {
		return "[]", nil
	}
	return json.Marshal(a)
}

func (a *JSONStringArray) Scan(value interface{}) error {
	if value == nil {
		*a = make([]string, 0)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, a)
}

// Employee represents detailed HR data linked to a User
type Employee struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    *uuid.UUID `gorm:"type:uuid;unique" json:"user_id,omitempty"` // Nullable if creating employee before user
	User      *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`

	// Biodata
	NIK            string    `gorm:"uniqueIndex" json:"nik"`
	KTPNumber      string    `json:"ktp_number"` // NIK KTP
	Name           string    `json:"name"`       // Full Name (Master Data)
	PhotoURL       string    `json:"photo_url"`  // URL to employee photo
	Gender         string    `json:"gender"` // L/P
	PlaceOfBirth   string    `json:"place_of_birth"`
	DateOfBirth    time.Time `json:"date_of_birth"`
	MaritalStatus  string    `json:"marital_status"` // KAWIN, BELUM, DUDA, JANDA
	ChildrenCount  int       `json:"children_count"`
	Address        string    `json:"address"`
	ResidenceStatus string   `json:"residence_status"` // RUMAH SENDIRI, KONTRAK, dll
	Religion       string    `json:"religion"`
	BloodType      string    `json:"blood_type"`

	// Emergency Contact
	EmergencyContactName     string `json:"emergency_contact_name"`
	EmergencyContactPhone    string `json:"emergency_contact_phone"`
	EmergencyContactRelation string `json:"emergency_contact_relation"`

	// Employment
	Position         string    `json:"position"`
	OfficeID         uuid.UUID `gorm:"type:uuid" json:"office_id"`
	Office           *Office   `gorm:"foreignKey:OfficeID" json:"office,omitempty"`
	StartDate        time.Time `json:"start_date"`
	EmploymentStatus string    `json:"employment_status"` // PKWT, PKWTT, MAGANG, LAINNYA
	EndContractDate  *time.Time `json:"end_contract_date,omitempty"` // For PKWT

	// Management & Roles
	IsManager     bool       `gorm:"default:false" json:"is_manager"`
	ManagerID     *uuid.UUID `gorm:"type:uuid" json:"manager_id,omitempty"`
	Manager       *User      `gorm:"foreignKey:ManagerID" json:"manager,omitempty"` // Manager is a User (likely also an Employee, but linked via UserID for auth)
	IsEvaluator   bool       `gorm:"default:false" json:"is_evaluator"`

	// Competency & Education
	Education             string          `json:"education"` // SD..DOCTORAL
	Grade                 string          `json:"grade"`     // GRADE 1..10
	Competencies          string          `json:"competencies"` // Text description
	CompetencyAttachments JSONStringArray `gorm:"type:jsonb" json:"competency_attachments"`

	// Payroll & Benefits
	IsAllowance     bool            `gorm:"default:false" json:"is_allowance"`
	Allowances      JSONStringArray `gorm:"type:jsonb" json:"allowances"` // Array of allowance names
	BankAccount     string          `json:"bank_account"`
	BankName        string          `json:"bank_name"`
	BPJSKesehatan   string          `json:"bpjs_kesehatan"`
	BPJSTenagaKerja string          `json:"bpjs_tenaga_kerja"`
	NPWP            string          `json:"npwp"`
	BasicSalary     float64         `json:"basic_salary"`

	// Exit
	ResignationDate   *time.Time `json:"resignation_date,omitempty"`
	ResignationReason string     `json:"resignation_reason,omitempty"`

	// Leave
	LeaveBalance int `gorm:"default:12" json:"leave_balance"`
	LeaveUsed    int `gorm:"default:0" json:"leave_used"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	WorkExperiences     []WorkExperience     `gorm:"foreignKey:EmployeeID" json:"work_experiences,omitempty"`
	EmployeeEvaluations []EmployeeEvaluation `gorm:"foreignKey:EmployeeID" json:"employee_evaluations,omitempty"`
}

// WorkExperience represents past employment history
type WorkExperience struct {
	ID             uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	EmployeeID     uuid.UUID       `gorm:"type:uuid;not null" json:"employee_id"`
	CompanyName    string          `gorm:"not null" json:"company_name"`
	StartDate      time.Time       `json:"start_date"`
	EndDate        time.Time       `json:"end_date"`
	Description    string          `json:"description"`
	AttachmentURLs JSONStringArray `gorm:"type:jsonb" json:"attachment_urls"`
	CreatedAt      time.Time       `gorm:"autoCreateTime" json:"created_at"`
}

// EmployeeEvaluation represents annual performance reviews
type EmployeeEvaluation struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	EmployeeID  uuid.UUID `gorm:"type:uuid;not null" json:"employee_id"`
	Year        int       `json:"year"`
	Score       string    `json:"score"` // CUKUP, CUKUP BAIK, BAIK, SANGAT BAIK, ISTIMEWA
	EvaluatorID uuid.UUID `gorm:"type:uuid" json:"evaluator_id"`
	Evaluator   *User     `gorm:"foreignKey:EvaluatorID" json:"evaluator,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}
