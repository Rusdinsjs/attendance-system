package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/attendance-system/internal/models"
	"github.com/attendance-system/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// KioskHandler handles kiosk-related endpoints
type KioskHandler struct {
	userRepo       *repository.UserRepository
	attendanceRepo *repository.AttendanceRepository
	settingsRepo   *repository.SettingsRepository
	kioskRepo      *repository.KioskRepository
	facePhotoRepo  *repository.FacePhotoRepository
	wsHub          *WebSocketHub
}

// NewKioskHandler creates a new kiosk handler
func NewKioskHandler(
	userRepo *repository.UserRepository,
	attendanceRepo *repository.AttendanceRepository,
	settingsRepo *repository.SettingsRepository,
	kioskRepo *repository.KioskRepository,
	facePhotoRepo *repository.FacePhotoRepository,
	wsHub *WebSocketHub,
) *KioskHandler {
	return &KioskHandler{
		userRepo:       userRepo,
		attendanceRepo: attendanceRepo,
		settingsRepo:   settingsRepo,
		kioskRepo:      kioskRepo,
		facePhotoRepo:  facePhotoRepo,
		wsHub:          wsHub,
	}
}

// ScanQRRequest represents QR code scan payload
type ScanQRRequest struct {
	EmployeeID string `json:"employee_id" binding:"required"`
}

// ScanQRResponse returns employee info after QR scan
type ScanQRResponse struct {
	Success        bool     `json:"success"`
	EmployeeID     string   `json:"employee_id"`
	Name           string   `json:"name"`
	HasFaceData    bool     `json:"has_face_data"`
	TodayStatus    string   `json:"today_status"` // not_checked_in, checked_in, checked_out
	CheckInTime    *string  `json:"check_in_time,omitempty"`
	FaceEmbeddings [][]float64 `json:"face_embeddings,omitempty"`
}

// ScanQR verifies QR code and returns employee info
// POST /api/kiosk/scan
func (h *KioskHandler) ScanQR(c *gin.Context) {
	var req ScanQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user by employee ID
	user, err := h.userRepo.FindByEmployeeID(c.Request.Context(), req.EmployeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Karyawan tidak ditemukan",
		})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Akun tidak aktif",
		})
		return
	}

	// Check face verification status
	hasFaceData := user.FaceVerificationStatus == "verified" && len(user.FaceEmbeddings) > 0

	// Get today's attendance status
	todayStatus := "not_checked_in"
	var checkInTime *string
	attendance, _ := h.attendanceRepo.FindTodayByUserID(c.Request.Context(), user.ID)
	if attendance != nil {
		if attendance.CheckOutTime != nil {
			todayStatus = "checked_out"
		} else if attendance.CheckInTime != nil {
			todayStatus = "checked_in"
			timeStr := attendance.CheckInTime.Format("15:04:05")
			checkInTime = &timeStr
		}
	}

	response := ScanQRResponse{
		Success:     true,
		EmployeeID:  user.EmployeeID,
		Name:        user.Name,
		HasFaceData: hasFaceData,
		TodayStatus: todayStatus,
		CheckInTime: checkInTime,
	}

	// Include face embeddings for client-side matching
	if hasFaceData {
		response.FaceEmbeddings = user.FaceEmbeddings
	}

	c.JSON(http.StatusOK, response)
}

// VerifyFaceRequest represents face verification payload
type VerifyFaceRequest struct {
	EmployeeID     string    `json:"employee_id" binding:"required"`
	FaceEmbedding  []float64 `json:"face_embedding" binding:"required"`
}

// VerifyFace compares face embedding with stored data
// POST /api/kiosk/verify-face
func (h *KioskHandler) VerifyFace(c *gin.Context) {
	var req VerifyFaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userRepo.FindByEmployeeID(c.Request.Context(), req.EmployeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if len(user.FaceEmbeddings) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No face data registered",
		})
		return
	}

	// Compare with stored embeddings - find minimum distance
	threshold := 0.6 // Adjustable threshold
	minDistance := float64(999)
	
	for _, storedEmbed := range user.FaceEmbeddings {
		distance := euclideanDistance(req.FaceEmbedding, storedEmbed)
		if distance < minDistance {
			minDistance = distance
		}
	}

	matched := minDistance < threshold

	c.JSON(http.StatusOK, gin.H{
		"success":  matched,
		"distance": minDistance,
		"message":  ternary(matched, "Wajah terverifikasi", "Wajah tidak cocok"),
	})
}

// VerifyFaceImageRequest represents face verification with base64 image
type VerifyFaceImageRequest struct {
	EmployeeID  string `json:"employee_id" binding:"required"`
	ImageBase64 string `json:"image_base64" binding:"required"`
}

// VerifyFaceImage verifies face from base64 webcam capture
// POST /api/kiosk/verify-face-image
func (h *KioskHandler) VerifyFaceImage(c *gin.Context) {
	var req VerifyFaceImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user
	user, err := h.userRepo.FindByEmployeeID(c.Request.Context(), req.EmployeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "User not found"})
		return
	}

	if len(user.FaceEmbeddings) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No face data registered",
		})
		return
	}

	// Decode base64 image - Remove data URL prefix if present
	imageData := req.ImageBase64
	if strings.HasPrefix(imageData, "data:image/jpeg;base64,") {
		imageData = strings.TrimPrefix(imageData, "data:image/jpeg;base64,")
	} else if strings.HasPrefix(imageData, "data:image/png;base64,") {
		imageData = strings.TrimPrefix(imageData, "data:image/png;base64,")
	} else if strings.HasPrefix(imageData, "data:image/webp;base64,") {
		imageData = strings.TrimPrefix(imageData, "data:image/webp;base64,")
	}
	
	decodedImage, err := base64.StdEncoding.DecodeString(imageData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid base64 image"})
		return
	}

	// Save to temp file
	tempDir := filepath.Join("uploads", "temp")
	os.MkdirAll(tempDir, 0755)
	tempFile := filepath.Join(tempDir, fmt.Sprintf("verify_%s_%d.jpg", user.ID.String(), time.Now().UnixNano()))
	
	if err := os.WriteFile(tempFile, decodedImage, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to save temp image"})
		return
	}
	defer os.Remove(tempFile) // Clean up after

	// Call Face Service to extract embedding
	faceServiceURL := os.Getenv("FACE_SERVICE_URL")
	if faceServiceURL == "" {
		faceServiceURL = "http://localhost:5001"
	}

	extractReqBody, _ := json.Marshal(map[string]interface{}{
		"image_paths": []string{"/" + tempFile},
	})

	extractResp, err := http.Post(
		faceServiceURL+"/extract-embeddings",
		"application/json",
		bytes.NewBuffer(extractReqBody),
	)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": "Face service unavailable"})
		return
	}
	defer extractResp.Body.Close()

	var extractResult struct {
		Success    bool        `json:"success"`
		Embeddings [][]float64 `json:"embeddings"`
		Error      string      `json:"error"`
	}
	
	respBody, _ := io.ReadAll(extractResp.Body)
	if err := json.Unmarshal(respBody, &extractResult); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to parse face service response"})
		return
	}

	if !extractResult.Success || len(extractResult.Embeddings) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No face detected in image. " + extractResult.Error,
		})
		return
	}

	// Compare extracted embedding with stored embeddings
	probeEmbedding := extractResult.Embeddings[0]
	
	// Get threshold from settings
	thresholdSetting, _ := h.settingsRepo.GetByKey(c.Request.Context(), "face_verification_threshold")
	threshold := 0.6
	if thresholdSetting != nil {
		if t, err := strconv.ParseFloat(thresholdSetting.Value, 64); err == nil {
			threshold = t
		}
	}
	
	minDistance := float64(999)
	for _, storedEmbed := range user.FaceEmbeddings {
		distance := euclideanDistance(probeEmbedding, storedEmbed)
		if distance < minDistance {
			minDistance = distance
		}
	}

	matched := minDistance < threshold
	similarity := 1 - minDistance
	if similarity < 0 {
		similarity = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    matched,
		"match":      matched,
		"distance":   minDistance,
		"similarity": similarity,
		"threshold":  threshold,
		"message":    ternary(matched, "Wajah terverifikasi", "Wajah tidak cocok"),
	})
}

// KioskCheckInRequest represents kiosk check-in payload
type KioskCheckInRequest struct {
	EmployeeID string `json:"employee_id" binding:"required"`
	KioskID    string `json:"kiosk_id"`
}

// KioskCheckIn records attendance via kiosk
// POST /api/kiosk/check-in
func (h *KioskHandler) KioskCheckIn(c *gin.Context) {
	var req KioskCheckInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify Kiosk
	kiosk, err := h.kioskRepo.FindByKioskID(c.Request.Context(), req.KioskID)
	if err != nil || kiosk == nil || !kiosk.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Perangkat Kiosk tidak terdaftar atau tidak aktif"})
		return
	}
	_ = h.kioskRepo.UpdateLastSeen(c.Request.Context(), kiosk.ID)

	user, err := h.userRepo.FindByEmployeeID(c.Request.Context(), req.EmployeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Check if already checked in today
	existingAttendance, _ := h.attendanceRepo.FindTodayByUserID(c.Request.Context(), user.ID)
	if existingAttendance != nil && existingAttendance.CheckInTime != nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":         "Sudah check-in hari ini",
			"check_in_time": existingAttendance.CheckInTime,
		})
		return
	}

	// Determine if late
	now := time.Now()
	isLate := now.Hour() >= 9 && now.Minute() > 0

	// Use user's office location for kiosk check-in
	attendance := &models.Attendance{
		UserID:      user.ID,
		CheckInTime: &now,
		CheckInLat:  &user.OfficeLat,
		CheckInLong: &user.OfficeLong,
		DeviceInfo:  "Kiosk: " + req.KioskID,
		IsLate:      isLate,
	}

	if err := h.attendanceRepo.Create(c.Request.Context(), attendance); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record check-in"})
		return
	}

	// Broadcast to WebSocket
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
		"success":    true,
		"message":    "Check-in berhasil!",
		"name":       user.Name,
		"time":       now.Format("15:04:05"),
		"is_late":    isLate,
		"attendance": attendance,
	})
}

// KioskCheckOut records check-out via kiosk
// POST /api/kiosk/check-out
func (h *KioskHandler) KioskCheckOut(c *gin.Context) {
	var req KioskCheckInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify Kiosk
	kiosk, err := h.kioskRepo.FindByKioskID(c.Request.Context(), req.KioskID)
	if err != nil || kiosk == nil || !kiosk.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Perangkat Kiosk tidak terdaftar atau tidak aktif"})
		return
	}
	_ = h.kioskRepo.UpdateLastSeen(c.Request.Context(), kiosk.ID)

	user, err := h.userRepo.FindByEmployeeID(c.Request.Context(), req.EmployeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Find today's attendance
	attendance, err := h.attendanceRepo.FindTodayByUserID(c.Request.Context(), user.ID)
	if err != nil || attendance == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Belum check-in hari ini"})
		return
	}

	if attendance.CheckOutTime != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Sudah check-out hari ini"})
		return
	}

	// Update checkout
	now := time.Now()
	attendance.CheckOutTime = &now
	attendance.CheckOutLat = &user.OfficeLat
	attendance.CheckOutLong = &user.OfficeLong

	if err := h.attendanceRepo.Update(c.Request.Context(), attendance); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record check-out"})
		return
	}

	// Broadcast
	if h.wsHub != nil {
		h.wsHub.BroadcastAttendanceUpdate(AttendanceEvent{
			Type:       "check_out",
			UserID:     user.ID,
			UserName:   user.Name,
			EmployeeID: user.EmployeeID,
			Time:       now,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"message":    "Check-out berhasil!",
		"name":       user.Name,
		"time":       now.Format("15:04:05"),
		"attendance": attendance,
	})
}

// GetKioskStatus returns today's status for employee
// GET /api/kiosk/status/:employee_id
func (h *KioskHandler) GetKioskStatus(c *gin.Context) {
	employeeID := c.Param("employee_id")
	
	user, err := h.userRepo.FindByEmployeeID(c.Request.Context(), employeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	attendance, _ := h.attendanceRepo.FindTodayByUserID(c.Request.Context(), user.ID)
	
	status := "not_checked_in"
	if attendance != nil {
		if attendance.CheckOutTime != nil {
			status = "checked_out"
		} else if attendance.CheckInTime != nil {
			status = "checked_in"
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"employee_id": employeeID,
		"name":        user.Name,
		"status":      status,
		"attendance":  attendance,
	})
}

// AdminUnlockRequest for unlocking hidden registration
type AdminUnlockRequest struct {
	AdminCode string `json:"admin_code" binding:"required"`
}

// AdminUnlock verifies admin code for hidden features
// POST /api/kiosk/admin-unlock
func (h *KioskHandler) AdminUnlock(c *gin.Context) {
	var req AdminUnlockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get admin code from settings
	setting, err := h.settingsRepo.GetByKey(c.Request.Context(), "kiosk_admin_code")
	adminCode := "123456" // Default
	if err == nil && setting != nil {
		adminCode = setting.Value
	}

	if req.AdminCode != adminCode {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Kode admin salah"})
		return
	}

	// Generate temporary token valid for 10 minutes
	token := uuid.New().String()
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"message": "Mode registrasi aktif",
	})
}

// GetAvailableKiosks returns list of unpaired kiosks
// GET /api/kiosk/available
func (h *KioskHandler) GetAvailableKiosks(c *gin.Context) {
	adminCode := c.Query("code")

	// Verify admin code
	setting, err := h.settingsRepo.GetByKey(c.Request.Context(), "kiosk_admin_code")
	expectedCode := "123456"
	if err == nil && setting != nil {
		expectedCode = setting.Value
	}

	if adminCode != expectedCode {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid admin code"})
		return
	}

	kiosks, err := h.kioskRepo.FindAvailable(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch available kiosks"})
		return
	}

	// Transform to simple response
	var response []map[string]interface{}
	for _, k := range kiosks {
		response = append(response, map[string]interface{}{
			"id":       k.ID,
			"kiosk_id": k.KioskID,
			"name":     k.Name,
			"office":   k.Office.Name,
		})
	}

	c.JSON(http.StatusOK, response)
}

// PairKioskRequest represents payload for pairing
type PairKioskRequest struct {
	KioskID   string `json:"kiosk_id" binding:"required"`
	AdminCode string `json:"admin_code" binding:"required"`
}

// PairKiosk pairs a device with a kiosk ID
// POST /api/kiosk/pair
func (h *KioskHandler) PairKiosk(c *gin.Context) {
	var req PairKioskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify admin code
	setting, err := h.settingsRepo.GetByKey(c.Request.Context(), "kiosk_admin_code")
	expectedCode := "123456"
	if err == nil && setting != nil {
		expectedCode = setting.Value
	}

	if req.AdminCode != expectedCode {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kode admin salah"})
		return
	}

	// Find Kiosk
	kiosk, err := h.kioskRepo.FindByKioskID(c.Request.Context(), req.KioskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kiosk ID tidak ditemukan"})
		return
	}

	if kiosk.IsPaired {
		c.JSON(http.StatusConflict, gin.H{"error": "Kiosk ID sudah digunakan oleh perangkat lain"})
		return
	}

	// Mark as paired
	kiosk.IsPaired = true
	if err := h.kioskRepo.Update(c.Request.Context(), kiosk); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan status pairing"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Update berhasil dipasangkan",
		"kiosk":   kiosk,
	})
}

// Admin Kiosk Management Handlers

// GetAllKiosks returns all registered kiosks with pagination
// GET /api/admin/kiosks
func (h *KioskHandler) GetAllKiosks(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	kiosks, total, err := h.kioskRepo.GetAll(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch kiosks"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data":  kiosks,
		"total": total,
	})
}

// CreateKioskRequest represents payload for creating a kiosk
type CreateKioskRequest struct {
	Name     string `json:"name" binding:"required"`
	KioskID  string `json:"kiosk_id" binding:"required"`
	OfficeID string `json:"office_id" binding:"required"`
}

// CreateKiosk registers a new kiosk
// POST /api/admin/kiosks
func (h *KioskHandler) CreateKiosk(c *gin.Context) {
	var req CreateKioskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	officeID, err := uuid.Parse(req.OfficeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Office ID"})
		return
	}

	kiosk := &models.Kiosk{
		Name:     req.Name,
		KioskID:  req.KioskID,
		OfficeID: officeID,
		IsActive: true,
	}

	if err := h.kioskRepo.Create(c.Request.Context(), kiosk); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create kiosk: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, kiosk)
}

// UpdateKioskRequest represents payload for updating a kiosk
type UpdateKioskRequest struct {
	Name     string `json:"name" binding:"required"`
	OfficeID string `json:"office_id" binding:"required"`
	IsActive *bool  `json:"is_active"`
}

// UpdateKiosk updates an existing kiosk
// PUT /api/admin/kiosks/:id
func (h *KioskHandler) UpdateKiosk(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req UpdateKioskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	kiosk, err := h.kioskRepo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kiosk not found"})
		return
	}

	officeID, err := uuid.Parse(req.OfficeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Office ID"})
		return
	}

	kiosk.Name = req.Name
	kiosk.OfficeID = officeID
	if req.IsActive != nil {
		kiosk.IsActive = *req.IsActive
	}

	if err := h.kioskRepo.Update(c.Request.Context(), kiosk); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update kiosk"})
		return
	}

	c.JSON(http.StatusOK, kiosk)
}

// DeleteKiosk removes a kiosk
// DELETE /api/admin/kiosks/:id
func (h *KioskHandler) DeleteKiosk(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	if err := h.kioskRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete kiosk"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Kiosk deleted successfully"})
}

// UnpairKiosk resets the paired status of a kiosk
// POST /api/admin/kiosks/:id/unpair
func (h *KioskHandler) UnpairKiosk(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	kiosk, err := h.kioskRepo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kiosk not found"})
		return
	}

	kiosk.IsPaired = false
	if err := h.kioskRepo.Update(c.Request.Context(), kiosk); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unpair kiosk"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Kiosk unpaired successfully"})
}

// GetKioskSettings returns public settings for kiosk
// GET /api/kiosk/settings
func (h *KioskHandler) GetKioskSettings(c *gin.Context) {
	settings, err := h.settingsRepo.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get settings"})
		return
	}

	// Filter only public settings
	publicSettings := make(map[string]string)
	allowedKeys := map[string]bool{
		"company_name":               true,
		"company_address":            true,
		"company_logo":               true,
		"kiosk_screensaver_timeout": true,
	}

	for _, s := range settings {
		if allowedKeys[s.Key] {
			publicSettings[s.Key] = s.Value
		}
	}

	c.JSON(http.StatusOK, publicSettings)
}

// GetEmployeesForRegistration returns list of employees eligible for face registration
// GET /api/kiosk/employees-for-registration
func (h *KioskHandler) GetEmployeesForRegistration(c *gin.Context) {
	adminCode := c.Query("code")

	// Verify admin code
	setting, err := h.settingsRepo.GetByKey(c.Request.Context(), "kiosk_admin_code")
	expectedCode := "123456"
	if err == nil && setting != nil {
		expectedCode = setting.Value
	}

	if adminCode != expectedCode {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid admin code"})
		return
	}

	users, err := h.userRepo.FindEmployeesForRegistration(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch employees"})
		return
	}

	// Transform to lightweight response
	var response []gin.H
	for _, u := range users {
		response = append(response, gin.H{
			"id":          u.ID,
			"employee_id": u.EmployeeID,
			"name":        u.Name,
		})
	}

	c.JSON(http.StatusOK, response)
}

// RegisterFace handles face registration from Kiosk
// POST /api/kiosk/register-face
func (h *KioskHandler) RegisterFace(c *gin.Context) {
	// 1. Verify Admin Code (Multipart form)
	adminCode := c.PostForm("admin_code")
	
	setting, err := h.settingsRepo.GetByKey(c.Request.Context(), "kiosk_admin_code")
	expectedCode := "123456"
	if err == nil && setting != nil {
		expectedCode = setting.Value
	}

	if adminCode != expectedCode {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid admin code"})
		return
	}

	// 2. Get Employee ID
	employeeID := c.PostForm("employee_id")
	if employeeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Employee ID required"})
		return
	}

	user, err := h.userRepo.FindByEmployeeID(c.Request.Context(), employeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Karyawan tidak ditemukan"})
		return
	}

	// 3. Handle Files
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form data"})
		return
	}

	files := form.File["photos"]
	if len(files) != 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Harus upload 5 foto"})
		return
	}

	// Create directory
	uploadDir := filepath.Join("uploads", "faces", user.ID.String())
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Delete existing photos if any
	_ = h.facePhotoRepo.DeleteByUserID(c.Request.Context(), user.ID)

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
			UserID:     user.ID,
			PhotoPath:  "/" + filePath,
			PhotoOrder: i + 1,
		}
		savedPhotos = append(savedPhotos, photo)
	}

	// Save to DB
	for _, photo := range savedPhotos {
		if err := h.facePhotoRepo.Create(c.Request.Context(), &photo); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save photo record"})
			return
		}
	}

	// Extract face embeddings via Python service
	faceServiceURL := os.Getenv("FACE_SERVICE_URL")
	if faceServiceURL == "" {
		faceServiceURL = "http://localhost:5001"
	}

	// Prepare image paths for Python service
	var imagePaths []string
	for _, photo := range savedPhotos {
		imagePaths = append(imagePaths, photo.PhotoPath)
	}

	embeddingReqBody, _ := json.Marshal(map[string]interface{}{
		"image_paths": imagePaths,
	})

	embeddingResp, err := http.Post(
		faceServiceURL+"/extract-embeddings",
		"application/json",
		bytes.NewBuffer(embeddingReqBody),
	)

	if err != nil {
		// Log error but don't fail - embeddings can be added later
		fmt.Printf("Warning: Failed to call face service: %v\n", err)
	} else {
		defer embeddingResp.Body.Close()
		
		if embeddingResp.StatusCode == http.StatusOK {
			respBody, _ := io.ReadAll(embeddingResp.Body)
			var embeddingResult struct {
				Success    bool        `json:"success"`
				Embeddings [][]float64 `json:"embeddings"`
				Count      int         `json:"count"`
			}
			if json.Unmarshal(respBody, &embeddingResult) == nil && embeddingResult.Success {
				user.FaceEmbeddings = models.FaceEmbeddings(embeddingResult.Embeddings)
				fmt.Printf("Successfully extracted %d face embeddings\n", embeddingResult.Count)
			}
		} else {
			respBody, _ := io.ReadAll(embeddingResp.Body)
			fmt.Printf("Warning: Face service returned status %d: %s\n", embeddingResp.StatusCode, string(respBody))
		}
	}

	// Update User Status
	user.FaceVerificationStatus = "verified"
	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Registrasi wajah berhasil dikirim. Menunggu verifikasi admin.",
	})
}

// GetCompanySettings returns public company info for kiosk
// GET /api/kiosk/company-settings
func (h *KioskHandler) GetCompanySettings(c *gin.Context) {
	keys := []string{"company_name", "company_address", "company_logo"}
	response := make(map[string]string)

	for _, key := range keys {
		setting, err := h.settingsRepo.GetByKey(c.Request.Context(), key)
		if err == nil && setting != nil {
			response[key] = setting.Value
		} else {
			response[key] = "" // Default empty if not set
		}
	}

	c.JSON(http.StatusOK, response)
}

// Helper functions
func euclideanDistance(a, b []float64) float64 {
	if len(a) != len(b) {
		return 999
	}
	sum := 0.0
	for i := range a {
		diff := a[i] - b[i]
		sum += diff * diff
	}
	return math.Sqrt(sum)
}

func ternary(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}

// ========== OFFLINE MODE SUPPORT ==========

// SyncDataResponse contains all data needed for offline kiosk operation
type SyncDataResponse struct {
	Employees    []EmployeeSyncData `json:"employees"`
	LastSyncTime string             `json:"last_sync_time"`
	OfficeInfo   OfficeSyncData     `json:"office_info"`
}

type EmployeeSyncData struct {
	ID             string      `json:"id"`
	EmployeeID     string      `json:"employee_id"`
	Name           string      `json:"name"`
	FaceEmbeddings [][]float64 `json:"face_embeddings"`
	IsActive       bool        `json:"is_active"`
}

type OfficeSyncData struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Address   string  `json:"address"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// SyncData returns all employee data for offline kiosk operation
// GET /api/kiosk/sync-data
func (h *KioskHandler) SyncData(c *gin.Context) {
	kioskID := c.Query("kiosk_id")
	adminCode := c.Query("code")

	// Verify admin code
	setting, err := h.settingsRepo.GetByKey(c.Request.Context(), "kiosk_admin_code")
	expectedCode := "123456"
	if err == nil && setting != nil {
		expectedCode = setting.Value
	}

	if adminCode != expectedCode {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid admin code"})
		return
	}

	// Get kiosk to determine office
	kiosk, err := h.kioskRepo.FindByKioskID(c.Request.Context(), kioskID)
	if err != nil || kiosk == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kiosk not found"})
		return
	}

	// Get all active employees with face data for this office
	filters := repository.UserFilters{
		OfficeID: kiosk.OfficeID.String(),
	}
	active := true
	filters.IsActive = &active

	users, _, err := h.userRepo.FindAll(c.Request.Context(), filters, 1000, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch employees"})
		return
	}

	// Transform to sync format
	var employees []EmployeeSyncData
	for _, user := range users {
		if user.FaceVerificationStatus == "verified" && len(user.FaceEmbeddings) > 0 {
			employees = append(employees, EmployeeSyncData{
				ID:             user.ID.String(),
				EmployeeID:     user.EmployeeID,
				Name:           user.Name,
				FaceEmbeddings: user.FaceEmbeddings,
				IsActive:       user.IsActive,
			})
		}
	}

	response := SyncDataResponse{
		Employees:    employees,
		LastSyncTime: time.Now().UTC().Format(time.RFC3339),
		OfficeInfo: OfficeSyncData{
			ID:        kiosk.Office.ID.String(),
			Name:      kiosk.Office.Name,
			Address:   kiosk.Office.Address,
			Latitude:  kiosk.Office.Latitude,
			Longitude: kiosk.Office.Longitude,
		},
	}

	c.JSON(http.StatusOK, response)
}

// KioskOfflineSyncRequest represents batch of offline attendance records
type KioskOfflineSyncRequest struct {
	KioskID   string                      `json:"kiosk_id" binding:"required"`
	AdminCode string                      `json:"admin_code" binding:"required"`
	Records   []KioskOfflineAttendanceRecord `json:"records" binding:"required"`
}

type KioskOfflineAttendanceRecord struct {
	EmployeeID string  `json:"employee_id" binding:"required"`
	Type       string  `json:"type" binding:"required,oneof=check-in check-out"`
	Timestamp  string  `json:"timestamp" binding:"required"`
	Confidence float64 `json:"confidence"`
}

// OfflineSync handles batch synchronization of offline attendance from kiosk
// POST /api/kiosk/offline-sync
func (h *KioskHandler) OfflineSync(c *gin.Context) {
	var req KioskOfflineSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify admin code
	setting, err := h.settingsRepo.GetByKey(c.Request.Context(), "kiosk_admin_code")
	expectedCode := "123456"
	if err == nil && setting != nil {
		expectedCode = setting.Value
	}

	if req.AdminCode != expectedCode {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid admin code"})
		return
	}

	// Verify kiosk
	kiosk, err := h.kioskRepo.FindByKioskID(c.Request.Context(), req.KioskID)
	if err != nil || kiosk == nil || !kiosk.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or inactive kiosk"})
		return
	}
	_ = h.kioskRepo.UpdateLastSeen(c.Request.Context(), kiosk.ID)

	synced := 0
	errors := []string{}

	for _, record := range req.Records {
		// Parse timestamp
		recordTime, err := time.Parse(time.RFC3339, record.Timestamp)
		if err != nil {
			errors = append(errors, "Invalid timestamp: "+record.Timestamp)
			continue
		}

		// Reject future timestamps
		if recordTime.After(time.Now().Add(5 * time.Minute)) {
			errors = append(errors, "Future timestamp rejected: "+record.Timestamp)
			continue
		}

		// Find user
		user, err := h.userRepo.FindByEmployeeID(c.Request.Context(), record.EmployeeID)
		if err != nil {
			errors = append(errors, "Employee not found: "+record.EmployeeID)
			continue
		}

		recordDate := recordTime.Format("2006-01-02")

		if record.Type == "check-in" {
			// Check existing
			existing, _ := h.attendanceRepo.FindByUserAndDate(c.Request.Context(), user.ID, recordDate)
			if existing != nil && existing.CheckInTime != nil {
				errors = append(errors, "Already checked in: "+record.EmployeeID+" on "+recordDate)
				continue
			}

			isLate := recordTime.Hour() >= 9 && recordTime.Minute() > 0

			attendance := &models.Attendance{
				UserID:      user.ID,
				CheckInTime: &recordTime,
				CheckInLat:  &user.OfficeLat,
				CheckInLong: &user.OfficeLong,
				DeviceInfo:  "Kiosk (offline): " + req.KioskID,
				IsLate:      isLate,
				Notes:       fmt.Sprintf("Offline sync | Confidence: %.2f%%", record.Confidence*100),
			}

			if err := h.attendanceRepo.Create(c.Request.Context(), attendance); err != nil {
				errors = append(errors, "Failed to create check-in: "+err.Error())
				continue
			}
			synced++

		} else if record.Type == "check-out" {
			existing, err := h.attendanceRepo.FindByUserAndDate(c.Request.Context(), user.ID, recordDate)
			if err != nil || existing == nil {
				errors = append(errors, "No check-in found: "+record.EmployeeID+" on "+recordDate)
				continue
			}
			if existing.CheckOutTime != nil {
				errors = append(errors, "Already checked out: "+record.EmployeeID+" on "+recordDate)
				continue
			}

			existing.CheckOutTime = &recordTime
			existing.CheckOutLat = &user.OfficeLat
			existing.CheckOutLong = &user.OfficeLong
			existing.Notes = existing.Notes + " | Check-out synced offline"

			if err := h.attendanceRepo.Update(c.Request.Context(), existing); err != nil {
				errors = append(errors, "Failed to update check-out: "+err.Error())
				continue
			}
			synced++
		}
	}

	// Broadcast updates if any synced
	if synced > 0 && h.wsHub != nil {
		h.wsHub.Broadcast("kiosk:sync", gin.H{
			"kiosk_id": req.KioskID,
			"synced":   synced,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Sync completed",
		"synced":  synced,
		"errors":  errors,
	})
}

