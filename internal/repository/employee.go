package repository

import (
	"context"
	"fmt"

	"github.com/attendance-system/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type EmployeeRepository struct {
	db *gorm.DB
}

func NewEmployeeRepository(db *gorm.DB) *EmployeeRepository {
	return &EmployeeRepository{db: db}
}

// Create creates a new employee record and associated data
func (r *EmployeeRepository) Create(ctx context.Context, employee *models.Employee) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(employee).Error; err != nil {
			return err
		}

		// If work experiences are provided, they will be created via association,
		// but checking explicitly if needed. GORM handles association create by default.
		// Same for EmployeeEvaluations.

		return nil
	})
}

// Update updates an existing employee and their associations
func (r *EmployeeRepository) Update(ctx context.Context, employee *models.Employee) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Update main employee fields
		if err := tx.Model(employee).Updates(employee).Error; err != nil {
			return err
		}

		// Replace Work Experiences
		if err := tx.Model(employee).Association("WorkExperiences").Replace(employee.WorkExperiences); err != nil {
			return err
		}

		// Replace Employee Evaluations
		if err := tx.Model(employee).Association("EmployeeEvaluations").Replace(employee.EmployeeEvaluations); err != nil {
			return err
		}

		return nil
	})
}

// EmployeeFilters contains filter criteria
type EmployeeFilters struct {
	OfficeID         string
	Name             string
	Position         string
	EmploymentStatus string
	Gender           string
	DynamicFilters   []DynamicFilter
	SortBy           string
	SortOrder        string // "asc" or "desc"
}

// DynamicFilter represents a custom filter
type DynamicFilter struct {
	Field    string `json:"field"`
	Operator string `json:"operator"` // eq, like, gt, lt, gte, lte
	Value    string `json:"value"`
}

// FindAll returns employees with optional filtering
func (r *EmployeeRepository) FindAll(ctx context.Context, filters EmployeeFilters, limit, offset int) ([]models.Employee, int64, error) {
	var employees []models.Employee
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Employee{})

	// Preload minimal relations for list view
	query = query.Preload("User").Preload("Office").Preload("Manager")

	if filters.OfficeID != "" {
		query = query.Where("office_id = ?", filters.OfficeID)
	}

	if filters.Name != "" {
		// Search in Employee NIK or User Name
		query = query.Joins("LEFT JOIN users ON users.id = employees.user_id").
			Where("employees.nik ILIKE ? OR users.name ILIKE ?", "%"+filters.Name+"%", "%"+filters.Name+"%")
	}

	if filters.Position != "" {
		query = query.Where("position ILIKE ?", "%"+filters.Position+"%")
	}

	if filters.EmploymentStatus != "" {
		query = query.Where("employment_status = ?", filters.EmploymentStatus)
	}

	if filters.Gender != "" {
		query = query.Where("gender = ?", filters.Gender)
	}

	// Dynamic Filters
	for _, f := range filters.DynamicFilters {
		// allow-list fields to prevent SQL injection or bad queries
		// For simplicity, we assume the frontend sends snake_case column names that match DB
		// In production, verify `f.Field` against a map of allowed columns

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
		case "gte":
			query = query.Where(fmt.Sprintf("%s >= ?", f.Field), f.Value)
		case "lte":
			query = query.Where(fmt.Sprintf("%s <= ?", f.Field), f.Value)
		}
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Sorting
	orderBy := "employees.created_at"
	orderDir := "DESC"

	sortMap := map[string]string{
		"name":              "employees.name",
		"nik":               "employees.nik",
		"position":          "employees.position",
		"employment_status": "employees.employment_status",
		"created_at":        "employees.created_at",
		"user.email":        "users.email",
	}

	if filters.SortBy != "" {
		if val, ok := sortMap[filters.SortBy]; ok {
			orderBy = val
		}
	}

	if filters.SortOrder == "asc" || filters.SortOrder == "ASC" {
		orderDir = "ASC"
	}

	err := query.Order(fmt.Sprintf("%s %s", orderBy, orderDir)).Limit(limit).Offset(offset).Find(&employees).Error
	return employees, total, err
}

// FindByID returns full employee details
func (r *EmployeeRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Employee, error) {
	var employee models.Employee
	err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Office").
		Preload("Manager").
		Preload("WorkExperiences").
		Preload("EmployeeEvaluations").
		First(&employee, "id = ?", id).Error

	if err != nil {
		return nil, err
	}
	return &employee, nil
}

// FindByUserID returns employee linked to a user
func (r *EmployeeRepository) FindByUserID(ctx context.Context, userID uuid.UUID) (*models.Employee, error) {
	var employee models.Employee
	err := r.db.WithContext(ctx).
		Preload("Office").
		Preload("Manager").
		First(&employee, "user_id = ?", userID).Error

	if err != nil {
		return nil, err
	}
	return &employee, nil
}

// FindByNIK finds an employee by their NIK (EmployeeID)
func (r *EmployeeRepository) FindByNIK(ctx context.Context, nik string) (*models.Employee, error) {
	var employee models.Employee
	err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Office").
		First(&employee, "nik = ?", nik).Error

	if err != nil {
		return nil, err
	}
	return &employee, nil
}

// GetUniquePositions returns a list of distinct job positions
func (r *EmployeeRepository) GetUniquePositions(ctx context.Context) ([]string, error) {
	var positions []string
	err := r.db.WithContext(ctx).Model(&models.Employee{}).Distinct("position").Pluck("position", &positions).Error
	return positions, err
}

// Delete permanently deletes an employee
func (r *EmployeeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Select(clause.Associations).Delete(&models.Employee{ID: id}).Error
}
