package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/repository"
	"github.com/attendance-system/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AttendanceHandler handles attendance-related endpoints
type AttendanceHandler struct {
	attendanceRepo *repository.AttendanceRepository
	userRepo       *repository.UserRepository
	wsHub          *WebSocketHub
}

// NewAttendanceHandler creates a new attendance handler
func NewAttendanceHandler(
	attendanceRepo *repository.AttendanceRepository,
	userRepo *repository.UserRepository,
	wsHub *WebSocketHub,
) *AttendanceHandler {
	return &AttendanceHandler{
		attendanceRepo: attendanceRepo,
		userRepo:       userRepo,
		wsHub:          wsHub,
	}
}

// CheckInRequest represents check-in payload
type CheckInRequest struct {
	Latitude       float64 `json:"latitude" binding:"required"`
	Longitude      float64 `json:"longitude" binding:"required"`
	DeviceInfo     string  `json:"device_info"`
	IsMockLocation bool    `json:"is_mock_location"`
}

// CheckOutRequest represents check-out payload
type CheckOutRequest struct {
	Latitude   float64 `json:"latitude" binding:"required"`
	Longitude  float64 `json:"longitude" binding:"required"`
	DeviceInfo string  `json:"device_info"`
}

// CheckIn handles employee check-in
// POST /api/attendance/check-in
func (h *AttendanceHandler) CheckIn(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req CheckInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if mock location is detected
	if req.IsMockLocation {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Mock location detected. Please disable fake GPS.",
			"code":  "MOCK_LOCATION_DETECTED",
		})
		return
	}

	// Get user for geofence validation
	user, err := h.userRepo.FindByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Validate geofence - server-side validation
	if !utils.IsWithinRadius(user.OfficeLat, user.OfficeLong, req.Latitude, req.Longitude, user.AllowedRadius) {
		distance := utils.GetDistance(user.OfficeLat, user.OfficeLong, req.Latitude, req.Longitude)
		c.JSON(http.StatusForbidden, gin.H{
			"error":         "You are outside the allowed check-in radius",
			"code":          "OUTSIDE_GEOFENCE",
			"distance":      distance,
			"allowed_radius": user.AllowedRadius,
		})
		return
	}

	// Check if already checked in today
	existingAttendance, _ := h.attendanceRepo.FindTodayByUserID(c.Request.Context(), userID.(uuid.UUID))
	if existingAttendance != nil && existingAttendance.CheckInTime != nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":         "Already checked in today",
			"code":          "ALREADY_CHECKED_IN",
			"check_in_time": existingAttendance.CheckInTime,
		})
		return
	}

	// Determine if late (example: office starts at 09:00)
	now := time.Now()
	isLate := now.Hour() >= 9 && now.Minute() > 0

	// Create attendance record
	attendance := &models.Attendance{
		UserID:         userID.(uuid.UUID),
		CheckInTime:    &now,
		CheckInLat:     &req.Latitude,
		CheckInLong:    &req.Longitude,
		DeviceInfo:     req.DeviceInfo,
		IsLate:         isLate,
		IsMockLocation: req.IsMockLocation,
	}

	if err := h.attendanceRepo.Create(c.Request.Context(), attendance); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record check-in"})
		return
	}

	// Broadcast to WebSocket clients
	if h.wsHub != nil {
		h.wsHub.BroadcastAttendanceUpdate(AttendanceEvent{
			Type:       "check_in",
			UserID:     user.ID,
			UserName:   user.Name,
			EmployeeID: user.EmployeeID,
			Time:       now,
			IsLate:     isLate,
		})
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Check-in successful",
		"attendance": attendance,
		"is_late":    isLate,
	})
}

// CheckOut handles employee check-out
// POST /api/attendance/check-out
func (h *AttendanceHandler) CheckOut(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req CheckOutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find today's attendance
	attendance, err := h.attendanceRepo.FindTodayByUserID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "No check-in record found for today",
			"code":  "NO_CHECK_IN",
		})
		return
	}

	// Check if already checked out
	if attendance.CheckOutTime != nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":          "Already checked out today",
			"code":           "ALREADY_CHECKED_OUT",
			"check_out_time": attendance.CheckOutTime,
		})
		return
	}

	// Update checkout
	now := time.Now()
	attendance.CheckOutTime = &now
	attendance.CheckOutLat = &req.Latitude
	attendance.CheckOutLong = &req.Longitude

	if err := h.attendanceRepo.Update(c.Request.Context(), attendance); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record check-out"})
		return
	}

	// Get user for broadcast
	user, _ := h.userRepo.FindByID(c.Request.Context(), userID.(uuid.UUID))

	// Broadcast to WebSocket clients
	if h.wsHub != nil && user != nil {
		h.wsHub.BroadcastAttendanceUpdate(AttendanceEvent{
			Type:       "check_out",
			UserID:     user.ID,
			UserName:   user.Name,
			EmployeeID: user.EmployeeID,
			Time:       now,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Check-out successful",
		"attendance": attendance,
	})
}

// GetHistory returns attendance history for current user
// GET /api/attendance/history
func (h *AttendanceHandler) GetHistory(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse pagination params
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	attendances, err := h.attendanceRepo.GetHistory(c.Request.Context(), userID.(uuid.UUID), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get attendance history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"attendances": attendances,
		"limit":       limit,
		"offset":      offset,
	})
}

// GetTodayStatus returns today's attendance status for current user
// GET /api/attendance/today
func (h *AttendanceHandler) GetTodayStatus(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	attendance, err := h.attendanceRepo.FindTodayByUserID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "not_checked_in",
			"attendance": nil,
		})
		return
	}

	status := "checked_in"
	if attendance.CheckOutTime != nil {
		status = "checked_out"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     status,
		"attendance": attendance,
	})
}

// GetAllToday returns attendance records with filters and pagination (admin/HR only)
// GET /api/admin/attendance/today
func (h *AttendanceHandler) GetAllToday(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	attendances, total, err := h.attendanceRepo.GetAllToday(c.Request.Context(), startDate, endDate, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get attendance records"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"attendances": attendances,
		"total":       total,
	})
}
