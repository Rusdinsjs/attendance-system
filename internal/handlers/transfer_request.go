package handlers

import (
	"net/http"

	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"strconv"
)

// TransferRequestHandler handles office transfer request endpoints
type TransferRequestHandler struct {
	transferRepo *repository.TransferRequestRepository
	userRepo     *repository.UserRepository
}

// NewTransferRequestHandler creates a new transfer request handler
func NewTransferRequestHandler(
	transferRepo *repository.TransferRequestRepository,
	userRepo *repository.UserRepository,
) *TransferRequestHandler {
	return &TransferRequestHandler{
		transferRepo: transferRepo,
		userRepo:     userRepo,
	}
}

// CreateRequest creates a new transfer request (employee)
// POST /api/users/transfer-requests
func (h *TransferRequestHandler) CreateRequest(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	uid := userID.(uuid.UUID)

	// Get current user
	user, err := h.userRepo.FindByID(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Check if already has pending request
	pending, _ := h.transferRepo.FindPendingByUserID(c.Request.Context(), uid)
	if pending != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Sudah ada permintaan yang sedang diproses"})
		return
	}

	var req struct {
		RequestedOfficeLat  float64 `json:"requested_office_lat" binding:"required"`
		RequestedOfficeLong float64 `json:"requested_office_long" binding:"required"`
		RequestedRadius     int     `json:"requested_radius"`
		Reason              string  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.RequestedRadius <= 0 {
		req.RequestedRadius = 50
	}

	request := &models.OfficeTransferRequest{
		UserID:              uid,
		CurrentOfficeLat:    user.OfficeLat,
		CurrentOfficeLong:   user.OfficeLong,
		RequestedOfficeLat:  req.RequestedOfficeLat,
		RequestedOfficeLong: req.RequestedOfficeLong,
		RequestedRadius:     req.RequestedRadius,
		Reason:              req.Reason,
		Status:              "pending",
	}

	if err := h.transferRepo.Create(c.Request.Context(), request); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Permintaan pindah lokasi berhasil dikirim",
		"request": request,
	})
}

// GetMyRequests returns transfer requests for current user (employee)
// GET /api/users/transfer-requests
func (h *TransferRequestHandler) GetMyRequests(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	requests, err := h.transferRepo.FindByUserID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get requests"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"requests": requests})
}

// GetPendingRequests returns pending transfer requests with pagination (admin)
// GET /api/admin/transfer-requests
func (h *TransferRequestHandler) GetPendingRequests(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	requests, total, err := h.transferRepo.FindByStatus(c.Request.Context(), "pending", limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get requests"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"requests": requests,
		"total":    total,
	})
}

// ApproveRequest approves a transfer request (admin)
// POST /api/admin/transfer-requests/:id/approve
func (h *TransferRequestHandler) ApproveRequest(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	request, err := h.transferRepo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	if request.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request already processed"})
		return
	}

	// Update user's office location
	user, err := h.userRepo.FindByID(c.Request.Context(), request.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.OfficeLat = request.RequestedOfficeLat
	user.OfficeLong = request.RequestedOfficeLong
	user.AllowedRadius = request.RequestedRadius

	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user location"})
		return
	}

	// Update request status
	request.Status = "approved"
	if err := h.transferRepo.Update(c.Request.Context(), request); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Transfer request approved",
		"request": request,
	})
}

// RejectRequest rejects a transfer request (admin)
// POST /api/admin/transfer-requests/:id/reject
func (h *TransferRequestHandler) RejectRequest(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	var req struct {
		AdminNote string `json:"admin_note"`
	}
	c.ShouldBindJSON(&req)

	request, err := h.transferRepo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	if request.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request already processed"})
		return
	}

	request.Status = "rejected"
	request.AdminNote = req.AdminNote

	if err := h.transferRepo.Update(c.Request.Context(), request); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Transfer request rejected",
		"request": request,
	})
}
