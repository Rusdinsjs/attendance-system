package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/repository"
	"github.com/attendance-system/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"encoding/json"
)

type EmployeeHandler struct {
	employeeRepo *repository.EmployeeRepository
	userRepo     *repository.UserRepository
}

func NewEmployeeHandler(employeeRepo *repository.EmployeeRepository, userRepo *repository.UserRepository) *EmployeeHandler {
	return &EmployeeHandler{
		employeeRepo: employeeRepo,
		userRepo:     userRepo,
	}
}

// CreateEmployeeRequest represents the payload for creating a new employee
type CreateEmployeeRequest struct {
	// If creating a new user account
	CreateUser bool   `json:"create_user"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Password   string `json:"password"`

	// Link to existing user
	UserID *string `json:"user_id"`

	models.Employee
}

// CreateEmployee handles the creation of a new employee
// POST /api/admin/employees
func (h *EmployeeHandler) CreateEmployee(c *gin.Context) {
	var req CreateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Handle User Account Creation or Linking
	var userID *uuid.UUID
	if req.CreateUser {
		if req.Email == "" || req.Password == "" || req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email, Password, and Name are required for new user"})
			return
		}
		
		hashedPassword, err := utils.HashPassword(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		user := &models.User{
			Name:         req.Name,
			Email:        req.Email,
			PasswordHash: hashedPassword,
			Role:         "employee",
			EmployeeID:   req.NIK, // Use NIK as initial EmployeeID for User struct
			IsActive:     true,
			OfficeID:     &req.OfficeID,
			OfficeLat:    -6.2088, // Default fallback, should be set from Office
			OfficeLong:   106.8456,
		}

		if err := h.userRepo.Create(c.Request.Context(), user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user account: " + err.Error()})
			return
		}
		userID = &user.ID
	} else if req.UserID != nil && *req.UserID != "" {
		uid, err := uuid.Parse(*req.UserID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid User ID"})
			return
		}
		userID = &uid
	}

	// 2. Prepare Employee Data
	employee := req.Employee
	employee.Name = req.Name // Map top-level Name to Employee struct
	employee.ID = uuid.New()
	employee.UserID = userID
	
	// Ensure relations have IDs if not set
	for i := range employee.WorkExperiences {
		if employee.WorkExperiences[i].ID == uuid.Nil {
			employee.WorkExperiences[i].ID = uuid.New()
		}
		employee.WorkExperiences[i].EmployeeID = employee.ID
	}
	
	for i := range employee.EmployeeEvaluations {
		if employee.EmployeeEvaluations[i].ID == uuid.Nil {
			employee.EmployeeEvaluations[i].ID = uuid.New()
		}
		employee.EmployeeEvaluations[i].EmployeeID = employee.ID
	}

	if err := h.employeeRepo.Create(c.Request.Context(), &employee); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create employee: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, employee)
}

// UpdateEmployee updates an existing employee
// PUT /api/admin/employees/:id
func (h *EmployeeHandler) UpdateEmployee(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req models.Employee
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.ID = id
	// Ensure relationship FKs stay correct
	for i := range req.WorkExperiences {
		req.WorkExperiences[i].EmployeeID = id
	}
	for i := range req.EmployeeEvaluations {
		req.EmployeeEvaluations[i].EmployeeID = id
	}

	if err := h.employeeRepo.Update(c.Request.Context(), &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update employee: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, req)
}

// GetEmployee returns details of a single employee
// GET /api/admin/employees/:id
func (h *EmployeeHandler) GetEmployee(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	employee, err := h.employeeRepo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Employee not found"})
		return
	}

	c.JSON(http.StatusOK, employee)
}

// GetAllEmployees returns a list of employees
// GET /api/admin/employees
func (h *EmployeeHandler) GetAllEmployees(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	
	filters := repository.EmployeeFilters{
		OfficeID:         c.Query("office_id"),
		Name:             c.Query("name"),
		Position:         c.Query("position"),
		EmploymentStatus: c.Query("employment_status"),
		Gender:           c.Query("gender"),
	}

	// Parse Dynamic Filters JSON
	dynamicFiltersJson := c.Query("filters")
	if dynamicFiltersJson != "" {
		var dynamicFilters []repository.DynamicFilter
		if err := json.Unmarshal([]byte(dynamicFiltersJson), &dynamicFilters); err == nil {
			filters.DynamicFilters = dynamicFilters
		}
	}

	employees, total, err := h.employeeRepo.FindAll(c.Request.Context(), filters, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch employees"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  employees,
		"total": total,
	})
}


// DeleteEmployee deletes an employee
// DELETE /api/admin/employees/:id
func (h *EmployeeHandler) DeleteEmployee(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	if err := h.employeeRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete employee"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Employee deleted successfully"})
}

// UploadPhoto handles employee photo upload
// POST /api/admin/employees/:id/photo
func (h *EmployeeHandler) UploadPhoto(c *gin.Context) {
	idParam := c.Param("id")
	employeeID, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid employee ID"})
		return
	}

	// Get file from request
	file, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Ensure uploads directory exists
	uploadDir := "uploads/employees"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Generate filename: employeeID_timestamp.ext
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s_%d%s", employeeID.String(), time.Now().Unix(), ext)
	savePath := filepath.Join(uploadDir, filename)

	// Save file
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Update employee record
	photoURL := "/uploads/employees/" + filename
	employee, err := h.employeeRepo.FindByID(c.Request.Context(), employeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Employee not found"})
		return
	}

	employee.PhotoURL = photoURL
	if err := h.employeeRepo.Update(c.Request.Context(), employee); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update employee photo"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Photo uploaded successfully",
		"photo_url": photoURL,
	})
}

// ImportEmployees handles bulk import of employees from CSV
// POST /api/admin/employees/import
func (h *EmployeeHandler) ImportEmployees(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer f.Close()

	records, err := utils.ParseCSV(f)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse CSV: " + err.Error()})
		return
	}

	if len(records) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CSV file is empty or missing header"})
		return
	}

	headers := records[0]
	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[h] = i
	}

	// Helper to get value securely
	getValue := func(row []string, colName string) string {
		if idx, ok := headerMap[colName]; ok && idx < len(row) {
			return row[idx]
		}
		return ""
	}

	var importedCount int
	var skippedCount int
	var errors []string

	for i := 1; i < len(records); i++ {
		record := records[i]
		
		// Mandatory Fields
		nik := getValue(record, "NIK")
		name := getValue(record, "Nama Lengkap")
		
		if nik == "" || name == "" {
			errors = append(errors, fmt.Sprintf("Row %d: Missing NIK or Name", i+1))
			skippedCount++
			continue
		}

		// Basic Data
		email := getValue(record, "Email") // Optional, but needed for User creation
		position := getValue(record, "Posisi")
		officeIDStr := getValue(record, "ID Kantor")
		joinDateStr := getValue(record, "Tanggal Bergabung (YYYY-MM-DD)")

		// Check Duplicates (Basic check via Repo would be better, but for MVP check DB error)

		// 1. Parsing Office ID
		var officeID uuid.UUID
		if officeIDStr != "" {
			var err error
			officeID, err = uuid.Parse(officeIDStr)
			if err != nil {
				// Try to lookup by name? For now just log warning and set nil/default
				// Ideally we should fail row or default to something.
				// Let's rely on fallback logic or fail row.
				// For now: Fail row if Office ID is provided but invalid
				errors = append(errors, fmt.Sprintf("Row %d: Invalid Office ID", i+1))
				skippedCount++
				continue
			}
		} else {
			// Get Default Office or First Available?
			// For bulk import, Office ID really should be mandatory or we assign a default.
			// Let's assume mandatory for now as per current logic.
			errors = append(errors, fmt.Sprintf("Row %d: Missing Office ID", i+1))
			skippedCount++
			continue
		}

		// 2. Parse Date
		joinDate, err := time.Parse("2006-01-02", joinDateStr)
		if err != nil {
			joinDate = time.Now() 
		}

		empID := uuid.New()
		
		// 3. Populate All Fields
		emp := models.Employee{
			ID:               empID,
			NIK:              nik,
			Name:             name,
			Position:         position,
			OfficeID:         officeID,
			StartDate:        joinDate,
			EmploymentStatus: getValue(record, "Status Karyawan"), // PKWT/Tetap
			
			// Biodata
			KTPNumber:       getValue(record, "No KTP"),
			Gender:          getValue(record, "Gender (L/P)"),
			PlaceOfBirth:    getValue(record, "Tempat Lahir"),
			MaritalStatus:   getValue(record, "Status Pernikahan"),
			Address:         getValue(record, "Alamat"),
			ResidenceStatus: getValue(record, "Status Tempat Tinggal"),
			Religion:        getValue(record, "Agama"),
			BloodType:       getValue(record, "Golongan Darah"),
			
			// Emergency
			EmergencyContactName:     getValue(record, "Nama Kontak Darurat"),
			EmergencyContactPhone:    getValue(record, "No HP Kontak Darurat"),
			EmergencyContactRelation: getValue(record, "Hubungan Kontak Darurat"),
			
			// Bank & Tax
			BankAccount:     getValue(record, "No Rekening"),
			BankName:        getValue(record, "Nama Bank"),
			BPJSKesehatan:   getValue(record, "BPJS Kesehatan"),
			BPJSTenagaKerja: getValue(record, "BPJS Ketenagakerjaan"),
			NPWP:            getValue(record, "NPWP"),
			
			// Education
			Education:    getValue(record, "Pendidikan Terakhir"),
			Grade:        getValue(record, "Grade"),
			Competencies: getValue(record, "Kompetensi"),
		}

		// Parse Floats/Ints
		emp.ChildrenCount, _ = strconv.Atoi(getValue(record, "Jumlah Anak"))
		emp.BasicSalary, _ = strconv.ParseFloat(getValue(record, "Gaji Pokok"), 64)
		allowedRadius, _ := strconv.Atoi(getValue(record, "Radius (m)"))
		if allowedRadius == 0 {
			allowedRadius = 50 // Default
		}

		// Parse Dates
		if dobStr := getValue(record, "Tanggal Lahir (YYYY-MM-DD)"); dobStr != "" {
			if dob, err := time.Parse("2006-01-02", dobStr); err == nil {
				emp.DateOfBirth = dob
			}
		}
		if endConStr := getValue(record, "Akhir Kontrak (YYYY-MM-DD)"); endConStr != "" {
			if endCon, err := time.Parse("2006-01-02", endConStr); err == nil {
				emp.EndContractDate = &endCon
			}
		}

		// Create User Account Logic
		// If Email is provided, create User. If not, maybe just Employee?
		// Current system ties them tightly. Let's force User creation keying off email or NIK.
		// If email missing, generate dummy? "nik@system.local" ?
		if email == "" {
			email = fmt.Sprintf("%s@placeholder.com", nik)
		}

		hashedPwd, _ := utils.HashPassword("123456") // Default Password
		
		user := models.User{
			Name:         name,
			Email:        email,
			PasswordHash: hashedPwd,
			Role:         "employee",
			EmployeeID:   nik,
			IsActive:     true,
			OfficeID:     &officeID,
			AllowedRadius: allowedRadius,
		}

		if err := h.userRepo.Create(c.Request.Context(), &user); err != nil {
			// Duplicate email/nik likely
			errors = append(errors, fmt.Sprintf("Row %d: Failed to create user (%v)", i+1, err))
			skippedCount++
			continue
		}

		userID := user.ID
		emp.UserID = &userID

		if err := h.employeeRepo.Create(c.Request.Context(), &emp); err != nil {
			h.userRepo.Delete(c.Request.Context(), userID) // Rollback User
			errors = append(errors, fmt.Sprintf("Row %d: Failed to create employee (%v)", i+1, err))
			skippedCount++
			continue
		}

		importedCount++
	}

	c.JSON(http.StatusOK, gin.H{
		"imported": importedCount,
		"skipped":  skippedCount,
		"errors":   errors,
	})
}
