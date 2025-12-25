package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/repository"
	"github.com/gin-gonic/gin"
)

// SettingsHandler handles system settings endpoints
type SettingsHandler struct {
	settingsRepo *repository.SettingsRepository
}

// NewSettingsHandler creates a new settings handler
func NewSettingsHandler(settingsRepo *repository.SettingsRepository) *SettingsHandler {
	return &SettingsHandler{settingsRepo: settingsRepo}
}

// GetAllSettings returns all settings
// GET /api/admin/settings
func (h *SettingsHandler) GetAllSettings(c *gin.Context) {
	settings, err := h.settingsRepo.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get settings"})
		return
	}

	// Convert to map for easier frontend use
	settingsMap := make(map[string]string)
	for _, s := range settings {
		settingsMap[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, gin.H{
		"settings": settingsMap,
		"details":  settings,
	})
}

// UpdateSetting updates a single setting
// PUT /api/admin/settings/:key
func (h *SettingsHandler) UpdateSetting(c *gin.Context) {
	key := c.Param("key")

	var req struct {
		Value string `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	setting := &models.Setting{
		Key:   key,
		Value: req.Value,
	}

	if err := h.settingsRepo.Upsert(c.Request.Context(), setting); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update setting"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Setting updated",
		"setting": setting,
	})
}

// GetSetting returns a single setting by key
// GET /api/admin/settings/:key
func (h *SettingsHandler) GetSetting(c *gin.Context) {
	key := c.Param("key")

	setting, err := h.settingsRepo.GetByKey(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Setting not found"})
		return
	}

	c.JSON(http.StatusOK, setting)
}

// UploadLogo handles company logo upload
// POST /api/admin/settings/logo
func (h *SettingsHandler) UploadLogo(c *gin.Context) {
	// Get file from request
	file, err := c.FormFile("logo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Ensure uploads directory exists
	uploadDir := "uploads/settings"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Generate filename: logo_timestamp.ext
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("company_logo_%d%s", time.Now().Unix(), ext)
	savePath := filepath.Join(uploadDir, filename)

	// Save file
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Update setting
	logoURL := "/uploads/settings/" + filename
	setting := &models.Setting{
		Key:   "company_logo",
		Value: logoURL,
	}

	if err := h.settingsRepo.Upsert(c.Request.Context(), setting); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update logo setting"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Logo uploaded successfully",
		"logo_url": logoURL,
	})
}
