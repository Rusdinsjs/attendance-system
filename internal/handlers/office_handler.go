package handlers

import (
	"net/http"

	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"strconv"
)

type OfficeHandler struct {
	officeRepo *repository.OfficeRepository
}

func NewOfficeHandler(officeRepo *repository.OfficeRepository) *OfficeHandler {
	return &OfficeHandler{officeRepo: officeRepo}
}

// GetAllOffices returns all offices (public/protected) with optional pagination
// GET /api/offices
func (h *OfficeHandler) GetAllOffices(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "100") // Default higher for office dropdowns
	offsetStr := c.DefaultQuery("offset", "0")
	
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	offices, total, err := h.officeRepo.FindAll(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch offices"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"offices": offices,
		"total":   total,
	})
}

// CreateOffice creates a new office (admin)
// POST /api/admin/offices
func (h *OfficeHandler) CreateOffice(c *gin.Context) {
	var req struct {
		Name      string  `json:"name" binding:"required"`
		Address   string  `json:"address"`
		Latitude  float64 `json:"latitude" binding:"required"`
		Longitude float64 `json:"longitude" binding:"required"`
		Radius    int     `json:"radius"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Radius <= 0 {
		req.Radius = 50
	}

	office := &models.Office{
		Name:      req.Name,
		Address:   req.Address,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Radius:    req.Radius,
		IsActive:  true,
	}

	if err := h.officeRepo.Create(c.Request.Context(), office); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create office"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Office created successfully", "office": office})
}

// UpdateOffice updates an office (admin)
// PUT /api/admin/offices/:id
func (h *OfficeHandler) UpdateOffice(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid office ID"})
		return
	}

	var req struct {
		Name      string  `json:"name"`
		Address   string  `json:"address"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		Radius    int     `json:"radius"`
		IsActive  *bool   `json:"is_active"` // Pointer to handle false value
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	office, err := h.officeRepo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Office not found"})
		return
	}

	if req.Name != "" {
		office.Name = req.Name
	}
	if req.Address != "" {
		office.Address = req.Address
	}
	if req.Latitude != 0 {
		office.Latitude = req.Latitude
	}
	if req.Longitude != 0 {
		office.Longitude = req.Longitude
	}
	if req.Radius > 0 {
		office.Radius = req.Radius
	}
	if req.IsActive != nil {
		office.IsActive = *req.IsActive
	}

	if err := h.officeRepo.Update(c.Request.Context(), office); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update office"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Office updated successfully", "office": office})
}

// DeleteOffice deletes an office (admin)
// DELETE /api/admin/offices/:id
func (h *OfficeHandler) DeleteOffice(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid office ID"})
		return
	}

	if err := h.officeRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete office"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Office deleted successfully"})
}
