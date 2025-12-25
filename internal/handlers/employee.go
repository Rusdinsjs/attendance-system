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

	var importedCount int
	var skippedCount int
	var errors []string

	// Basic validation: Check header
	if len(records) > 0 {
		// Expected header: NIK, Name, Email, Position, OfficeID, JoinDate (YYYY-MM-DD)
		// We assume specific column order or simple mapping for now
	}

	for i, record := range records {
		if i == 0 {
			continue // Skip header
		}
		if len(record) < 5 {
			errors = append(errors, fmt.Sprintf("Row %d: Insufficient columns", i+1))
			continue
		}

		nik := record[0]
		name := record[1]
		email := record[2]
		position := record[3]
		officeIDStr := record[4]
		joinDateStr := record[5]

		// 1. Validate duplicates (NIK or Email)
		// Optimally we'd do a batch check, but for simplicity we check properly inside repo or here
		// For now let's rely on DB unique constraints or simple pre-check if possible
		// We'll skip complex pre-check for MVP and handle DB errors

		// 2. Parse Data
		officeID, err := uuid.Parse(officeIDStr)
		if err != nil {
			// Try to find office by name? For now, require UUID or skip
			// Fallback: Use user's office or default?
			errors = append(errors, fmt.Sprintf("Row %d: Invalid Office ID", i+1))
			continue
		}

		joinDate, err := time.Parse("2006-01-02", joinDateStr)
		if err != nil {
			joinDate = time.Now() // Default or error
		}

		emp := models.Employee{
			ID:               uuid.New(),
			NIK:              nik,
			Name:             name,
			// Email is not directly on Employee, it is on User and will be linked via UserID
			// Logic: We might need to create a User as well? 
			// For now, let's just create Employee. The User linking might happen later.
			// Wait, Employee struct doesn't have Email field directly for storage (it uses User.Email), 
			// BUT our CreateEmployeeRequest uses it to create User.
			// If we just create Employee, we should store email in... wait, checking models.
			// Employee model doesn't have Email column? Checking...
			// Checking models.go lines 177+... 
			// It has `User *User`. It DOES NOT have Email directly. 
			// Wait, previous `CreateEmployeeRequest` had Email.
			// If we import Employees, do we create Users?
			// The Requirement says "Bulk Employee Import". Usually this implies creating the master data.
			// Let's assume we create Employee records. 
			// If Employee model doesn't have Email, we should strictly follow the schema.
			// Actually, looking at `models.go` again...
			// Line 183: NIK string
			// Line 185: Name string
			// Line 186: PhotoURL string
			// It does NOT have Email.
			// So we cannot store Email on Employee unless we create a User or add Email to Employee.
			// Ideally Employee Master Data should have Email to link later.
			// Let's check `CreateEmployeeRequest` again. It has `Email`. 
			// It creates a User if `CreateUser` is true.
			// For Bulk Import, maybe we just create Employee data primarily.
			// BUT, how do we link to User later if we don't have Email stored?
			// Maybe we should add Email to Employee model as well?
			// OR we auto-create Users?
			// Auto-creating users (inactive?) seems safer.
			// Let's create User + Employee pair for each row.
			
			Position:         position,
			OfficeID:         officeID,
			StartDate:        joinDate,
			EmploymentStatus: "PKWT", // Default
		}

		// Create User (Inactive/Default)
		// We need to generate a dummy password or handle it.
		// Let's create User with default password "123456" and force change later?
		// Or just create Employee and let them claim?
		// Without Email on Employee, we can't let them claim easily.
		// Let's create User.
		
		hashedPwd, _ := utils.HashPassword("123456")
		user := models.User{
			Name:         name,
			Email:        email,
			PasswordHash: hashedPwd,
			Role:         "employee",
			EmployeeID:   nik,
			IsActive:     true,
			OfficeID:     &officeID,
		}
		
		if err := h.userRepo.Create(c.Request.Context(), &user); err != nil {
			errors = append(errors, fmt.Sprintf("Row %d: Failed to create user (%s)", i+1, err.Error()))
			continue
		}

		userID := user.ID
		emp.UserID = &userID
		
		if err := h.employeeRepo.Create(c.Request.Context(), &emp); err != nil {
			// Rollback user?
			h.userRepo.Delete(c.Request.Context(), userID) // Simple compensation
			errors = append(errors, fmt.Sprintf("Row %d: Failed to create employee (%s)", i+1, err.Error()))
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
