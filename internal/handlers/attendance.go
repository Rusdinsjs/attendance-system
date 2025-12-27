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
			"error":          "You are outside the allowed check-in radius",
			"code":           "OUTSIDE_GEOFENCE",
			"distance":       distance,
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

	filters := repository.AttendanceFilters{
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
		Position:  c.Query("position"),
		OfficeID:  c.Query("office_id"),
		Status:    c.Query("status"),
		SortBy:    c.Query("sort_by"),
		SortOrder: c.Query("sort_order"),
	}

	attendances, total, err := h.attendanceRepo.FindAll(c.Request.Context(), filters, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get attendance records"})
		return
	}

	// Get aggregation stats
	totalLate, totalOnTime, err := h.attendanceRepo.GetReportStats(c.Request.Context(), filters)
	if err != nil {
		// Log error but don't fail the request? Or fail?
		// Failing is probably safer to avoid misleading data.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get attendance stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"attendances":   attendances,
		"total":         total,
		"total_late":    totalLate,
		"total_on_time": totalOnTime,
	})
}

// GetDashboardStats returns aggregated stats for dashboard
// GET /api/admin/dashboard/stats
func (h *AttendanceHandler) GetDashboardStats(c *gin.Context) {
	period := c.DefaultQuery("period", "today")

	var startTime, endTime time.Time
	now := time.Now()

	// Prepare result container
	var graphData interface{}
	var total, present, late int64

	// Get total active employees
	users, err := h.userRepo.GetAll(c.Request.Context())
	var totalEmployees int64
	if err == nil {
		totalEmployees = int64(len(users))
	} else {
		// Log error (optional)
	}

	if period == "month" {
		// 1 month back from today (Rolling window)
		// User requested range e.g. 27/11 - 26/12 when today is 27/12.
		// StartDate: Today - 1 month
		// EndDate: Today - 1 day (Yesterday)
		oneMonthAgo := now.AddDate(0, -1, 0)
		startTime = time.Date(oneMonthAgo.Year(), oneMonthAgo.Month(), oneMonthAgo.Day(), 0, 0, 0, 0, now.Location())

		yesterday := now.AddDate(0, 0, -1)
		endTime = time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 23, 59, 59, 999999999, now.Location())

		dailyStats, err := h.attendanceRepo.GetDailyStats(c.Request.Context(), startTime, endTime)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch daily stats"})
			return
		}

		// Aggregation
		for _, stat := range dailyStats {
			total += stat.Total
			present += stat.Present
			late += stat.Late
		}
		graphData = dailyStats

	} else if period == "custom" {
		startDateStr := c.Query("start_date")
		endDateStr := c.Query("end_date")

		// Parse dates
		s, err1 := time.Parse("2006-01-02", startDateStr)
		e, err2 := time.Parse("2006-01-02", endDateStr)

		if err1 != nil || err2 != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Use YYYY-MM-DD"})
			return
		}

		startTime = time.Date(s.Year(), s.Month(), s.Day(), 0, 0, 0, 0, now.Location())
		endTime = time.Date(e.Year(), e.Month(), e.Day(), 23, 59, 59, 999999999, now.Location())

		dailyStats, err := h.attendanceRepo.GetDailyStats(c.Request.Context(), startTime, endTime)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch daily stats"})
			return
		}

		// Aggregation
		for _, stat := range dailyStats {
			total += stat.Total
			present += stat.Present
			late += stat.Late
		}
		graphData = dailyStats

	} else {
		// Today
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())

		hourlyStats, err := h.attendanceRepo.GetHourlyStats(c.Request.Context(), startTime, endTime)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch hourly stats"})
			return
		}

		// Aggregation
		for _, stat := range hourlyStats {
			total += stat.Total
			present += stat.Present
			late += stat.Late
		}
		graphData = hourlyStats
	}

	// 3. Get Total Employees
	users, _ = h.userRepo.GetAll(c.Request.Context())
	totalEmployees = int64(len(users))

	// Calculate Absent
	var absent int64
	if period == "today" {
		absent = totalEmployees - total
	} else {
		days := int64(endTime.Sub(startTime).Hours() / 24)
		if days < 1 {
			days = 1
		}

		potentialCheckins := totalEmployees * days
		absent = potentialCheckins - total
	}

	if absent < 0 {
		absent = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"stats": gin.H{
			"total_employees": totalEmployees,
			"present":         present,
			"late":            late,
			"absent":          absent,
			"total_checkins":  total,
		},
		"graph_data": graphData,
	})
}
