package repository

import (
	"context"

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
		query = query.Where("position = ?", filters.Position)
	}
	
	if filters.EmploymentStatus != "" {
		query = query.Where("employment_status = ?", filters.EmploymentStatus)
	}
	
	if filters.Gender != "" {
		query = query.Where("gender = ?", filters.Gender)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&employees).Error
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

// Delete permanently deletes an employee
func (r *EmployeeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Select(clause.Associations).Delete(&models.Employee{ID: id}).Error
}
