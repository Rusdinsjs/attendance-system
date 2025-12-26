package repository

import (
	"context"

	"github.com/attendance-system/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OfficeRepository struct {
	db *gorm.DB
}

func NewOfficeRepository(db *gorm.DB) *OfficeRepository {
	return &OfficeRepository{db: db}
}

func (r *OfficeRepository) Create(ctx context.Context, office *models.Office) error {
	return r.db.WithContext(ctx).Create(office).Error
}

func (r *OfficeRepository) FindAll(ctx context.Context, limit, offset int) ([]models.Office, int64, error) {
	var offices []models.Office
	var total int64
	
	query := r.db.WithContext(ctx).Model(&models.Office{})
	
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Limit(limit).Offset(offset).Find(&offices).Error
	return offices, total, err
}

func (r *OfficeRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Office, error) {
	var office models.Office
	err := r.db.WithContext(ctx).First(&office, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &office, nil
}

func (r *OfficeRepository) Update(ctx context.Context, office *models.Office) error {
	return r.db.WithContext(ctx).Save(office).Error
}

func (r *OfficeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Office{}, id).Error
}
