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
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// UserHandler handles user-related endpoints
type UserHandler struct {
	userRepo          *repository.UserRepository
	defaultOfficeLat  float64
	defaultOfficeLong float64
}

// NewUserHandler creates a new user handler
func NewUserHandler(
	userRepo *repository.UserRepository,
	defaultOfficeLat, defaultOfficeLong float64,
) *UserHandler {
	return &UserHandler{
		userRepo:          userRepo,
		defaultOfficeLat:  defaultOfficeLat,
		defaultOfficeLong: defaultOfficeLong,
	}
}

// UpdateFaceEmbeddingsRequest represents the face embeddings update payload
type UpdateFaceEmbeddingsRequest struct {
	FaceEmbeddings [][]float64 `json:"face_embeddings" binding:"required"`
}

// GetProfile returns current user's profile
// GET /api/users/me
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	user, err := h.userRepo.FindByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// UpdateFaceEmbeddings updates user's face embeddings
// PUT /api/users/face-embeddings
func (h *UserHandler) UpdateFaceEmbeddings(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdateFaceEmbeddingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate: must have at least 1 and at most 5 embeddings
	if len(req.FaceEmbeddings) < 1 || len(req.FaceEmbeddings) > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Face embeddings must have 1-5 vectors"})
		return
	}

	// Validate embedding dimensions (typically 128 or 512 for most face recognition models)
	for i, embedding := range req.FaceEmbeddings {
		if len(embedding) < 64 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid face embedding dimension", "index": i})
			return
		}
	}

	err := h.userRepo.UpdateFaceEmbeddings(
		c.Request.Context(),
		userID.(uuid.UUID),
		models.FaceEmbeddings(req.FaceEmbeddings),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update face embeddings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Face embeddings updated successfully"})
}

// SyncFaceData returns user's face embeddings for mobile sync
// GET /api/users/sync-face
func (h *UserHandler) SyncFaceData(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	user, err := h.userRepo.FindByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Return only necessary data for face sync
	c.JSON(http.StatusOK, gin.H{
		"user_id":         user.ID,
		"employee_id":     user.EmployeeID,
		"name":            user.Name,
		"face_embeddings": user.FaceEmbeddings,
		"office_lat":      user.OfficeLat,
		"office_long":     user.OfficeLong,
		"allowed_radius":  user.AllowedRadius,
	})
}

// GetAllUsers returns all users (admin only)
// GET /api/users
func (h *UserHandler) GetAllUsers(c *gin.Context) {
	users, err := h.userRepo.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// ChangePasswordRequest represents the change password payload
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6"`
}

// ChangePassword changes user's password
// PUT /api/users/password
func (h *UserHandler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	user, err := h.userRepo.FindByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Update password
	if err := h.userRepo.UpdatePasswordHash(c.Request.Context(), userID.(uuid.UUID), string(hashedPassword)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}

// CreateUserRequest represents create user payload
type CreateUserRequest struct {
	EmployeeID string `json:"employee_id" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=6"`
	Role       string `json:"role" binding:"required,oneof=admin hr employee"`
}

// CreateUser creates a new user (admin only)
// POST /api/admin/users
func (h *UserHandler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if email already exists
	existing, _ := h.userRepo.FindByEmail(c.Request.Context(), req.Email)
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	// Check if employee ID already exists
	existingEmp, _ := h.userRepo.FindByEmployeeID(c.Request.Context(), req.EmployeeID)
	if existingEmp != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Employee ID already registered"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create user
	user := &models.User{
		EmployeeID:   req.EmployeeID,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         req.Role,
		OfficeLat:    h.defaultOfficeLat,
		OfficeLong:   h.defaultOfficeLong,
		AllowedRadius: 50, // Default radius
		IsActive:     true,
	}

	if err := h.userRepo.Create(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

// UpdateUserRequest represents update user payload
type UpdateUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email" binding:"omitempty,email"`
	Role     string `json:"role" binding:"omitempty,oneof=admin hr employee"`
	Password string `json:"password" binding:"omitempty,min=6"`
	IsActive *bool  `json:"is_active"`
}

// UpdateUser updates a user (admin only)
// PUT /api/admin/users/:id
func (h *UserHandler) UpdateUser(c *gin.Context) {
	idParam := c.Param("id")
	userID, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing user
	user, err := h.userRepo.FindByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Update fields if provided
	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Email != "" {
		// Verify email uniqueness if changed? skipping for minimal MVP, DB will error
		user.Email = req.Email
	}
	if req.Role != "" {
		user.Role = req.Role
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}
	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		user.PasswordHash = string(hashedPassword)
	}

	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		// Simplify error handling for now
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

// DeleteUser deletes a user (admin only)
// DELETE /api/admin/users/:id
func (h *UserHandler) DeleteUser(c *gin.Context) {
	idParam := c.Param("id")
	userID, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.userRepo.Delete(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

// UploadAvatar handles avatar upload
// POST /api/users/:id/avatar
func (h *UserHandler) UploadAvatar(c *gin.Context) {
	idParam := c.Param("id")
	userID, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get file from request
	file, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Ensure uploads directory exists
	uploadDir := "uploads/avatars"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Generate filename: userID_timestamp.ext
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s_%d%s", userID.String(), time.Now().Unix(), ext)
	savePath := filepath.Join(uploadDir, filename)

	// Save file
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Update user record
	avatarURL := "/uploads/avatars/" + filename
	user, err := h.userRepo.FindByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.AvatarURL = avatarURL
	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Avatar uploaded successfully",
		"avatar_url": avatarURL,
	})
}
