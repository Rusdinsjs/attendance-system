package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// FaceVerificationHandler handles face verification endpoints
type FaceVerificationHandler struct {
	userRepo      *repository.UserRepository
	facePhotoRepo *repository.FacePhotoRepository
}

// NewFaceVerificationHandler creates a new face verification handler
func NewFaceVerificationHandler(
	userRepo *repository.UserRepository,
	facePhotoRepo *repository.FacePhotoRepository,
) *FaceVerificationHandler {
	return &FaceVerificationHandler{
		userRepo:      userRepo,
		facePhotoRepo: facePhotoRepo,
	}
}

// UploadFacePhotos handles uploading 5 face photos
// POST /api/users/face-photos
func (h *FaceVerificationHandler) UploadFacePhotos(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	uid := userID.(uuid.UUID)

	// Get user
	user, err := h.userRepo.FindByID(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Check if already pending or verified
	if user.FaceVerificationStatus == "pending" {
		c.JSON(http.StatusConflict, gin.H{"error": "Sudah ada pengajuan yang sedang diproses"})
		return
	}

	// Parse multipart form
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form data"})
		return
	}

	files := form.File["photos"]
	if len(files) != 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Harus upload exactly 5 foto"})
		return
	}

	// Create directory for user's face photos
	uploadDir := filepath.Join("uploads", "faces", uid.String())
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Delete existing photos if re-uploading
	if err := h.facePhotoRepo.DeleteByUserID(c.Request.Context(), uid); err != nil {
		// Log but continue
		fmt.Printf("Warning: failed to delete existing photos: %v\n", err)
	}

	// Save files
	var savedPhotos []models.FacePhoto
	for i, file := range files {
		filename := fmt.Sprintf("face_%d_%s", i+1, filepath.Base(file.Filename))
		filePath := filepath.Join(uploadDir, filename)

		if err := c.SaveUploadedFile(file, filePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save photo"})
			return
		}

		photo := models.FacePhoto{
			UserID:     uid,
			PhotoPath:  "/" + filePath, // Store as URL path
			PhotoOrder: i + 1,
		}
		savedPhotos = append(savedPhotos, photo)
	}

	// Save to database
	for _, photo := range savedPhotos {
		if err := h.facePhotoRepo.Create(c.Request.Context(), &photo); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save photo record"})
			return
		}
	}

	// Update user status to pending
	user.FaceVerificationStatus = "pending"
	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user status"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Foto berhasil diupload. Menunggu verifikasi admin.",
		"status":  "pending",
		"count":   len(savedPhotos),
	})
}

// GetPendingVerifications returns list of users pending face verification
// GET /api/admin/face-verifications
func (h *FaceVerificationHandler) GetPendingVerifications(c *gin.Context) {
	users, err := h.userRepo.FindByFaceStatus(c.Request.Context(), "pending")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get pending verifications"})
		return
	}

	// Load photos for each user
	type UserWithPhotos struct {
		models.User
		Photos []models.FacePhoto `json:"photos"`
	}

	var result []UserWithPhotos
	for _, user := range users {
		photos, _ := h.facePhotoRepo.FindByUserID(c.Request.Context(), user.ID)
		result = append(result, UserWithPhotos{
			User:   user,
			Photos: photos,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"verifications": result,
		"count":         len(result),
	})
}

// ApproveFaceVerification approves a user's face verification
// POST /api/admin/face-verifications/:id/approve
func (h *FaceVerificationHandler) ApproveFaceVerification(c *gin.Context) {
	userIDStr := c.Param("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.userRepo.FindByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if user.FaceVerificationStatus != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not pending verification"})
		return
	}

	// Get photos
	photos, err := h.facePhotoRepo.FindByUserID(c.Request.Context(), userID)
	if err != nil || len(photos) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No photos found for user"})
		return
	}

	// TODO: Here you would run actual face embedding extraction
	// For now, generate placeholder embeddings
	var embeddings [][]float64
	for i := 0; i < len(photos); i++ {
		embedding := generatePlaceholderEmbedding(photos[i].PhotoPath)
		embeddings = append(embeddings, embedding)
	}

	// Save embeddings to user
	user.FaceEmbeddings = models.FaceEmbeddings(embeddings)
	user.FaceVerificationStatus = "verified"

	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	// Delete photo files
	for _, photo := range photos {
		filePath := photo.PhotoPath
		if filePath[0] == '/' {
			filePath = filePath[1:] // Remove leading slash
		}
		os.Remove(filePath)
	}

	// Delete photo records
	h.facePhotoRepo.DeleteByUserID(c.Request.Context(), userID)

	c.JSON(http.StatusOK, gin.H{
		"message":    "Verifikasi berhasil. Data wajah telah disimpan.",
		"status":     "verified",
		"embeddings": len(embeddings),
	})
}

// RejectFaceVerification rejects a user's face verification
// POST /api/admin/face-verifications/:id/reject
func (h *FaceVerificationHandler) RejectFaceVerification(c *gin.Context) {
	userIDStr := c.Param("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	user, err := h.userRepo.FindByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Get photos to delete files
	photos, _ := h.facePhotoRepo.FindByUserID(c.Request.Context(), userID)
	for _, photo := range photos {
		filePath := photo.PhotoPath
		if filePath[0] == '/' {
			filePath = filePath[1:]
		}
		os.Remove(filePath)
	}

	// Delete photo records
	h.facePhotoRepo.DeleteByUserID(c.Request.Context(), userID)

	// Update user status
	user.FaceVerificationStatus = "rejected"
	h.userRepo.Update(c.Request.Context(), user)

	c.JSON(http.StatusOK, gin.H{
		"message": "Verifikasi ditolak.",
		"reason":  req.Reason,
	})
}

// generatePlaceholderEmbedding creates a placeholder embedding
// In production, this would use TensorFlow Lite with a face recognition model
func generatePlaceholderEmbedding(photoPath string) []float64 {
	embedding := make([]float64, 128)
	hash := 0
	for _, c := range photoPath {
		hash = (hash*31 + int(c)) & 0xFFFFFFFF
	}
	for i := 0; i < 128; i++ {
		val := float64((hash*(i+1))%1000) / 1000.0
		embedding[i] = val*2 - 1 // Normalize to [-1, 1]
	}
	return embedding
}
