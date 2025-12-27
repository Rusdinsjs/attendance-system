package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/attendance-system/internal/config"
	"github.com/attendance-system/internal/database"
	"github.com/attendance-system/internal/handlers"
	"github.com/attendance-system/internal/middleware"
	"github.com/attendance-system/internal/repository"
	"github.com/attendance-system/internal/utils"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Set Gin mode based on environment
	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Connect to PostgreSQL
	db, err := database.Connect(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Run auto-migrations
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Connect to Redis
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Redis.Host, cfg.Redis.Port),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	// Test Redis connection
	ctx := context.Background()
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Printf("⚠️ Warning: Failed to connect to Redis: %v", err)
	} else {
		log.Println("✅ Connected to Redis")
	}

	// Initialize JWT Manager
	jwtManager := utils.NewJWTManager(
		cfg.JWT.Secret,
		cfg.JWT.AccessExpiry,
		cfg.JWT.RefreshExpiry,
	)

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	attendanceRepo := repository.NewAttendanceRepository(db)
	refreshTokenRepo := repository.NewRefreshTokenRepository(db)
	officeRepo := repository.NewOfficeRepository(db)
	employeeRepo := repository.NewEmployeeRepository(db)


	// Initialize WebSocket hub
	wsHub := handlers.NewWebSocketHub()
	go wsHub.Run()

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(
		userRepo,
		refreshTokenRepo,
		jwtManager,
		cfg.Office.DefaultLat,
		cfg.Office.DefaultLong,
	)
	userHandler := handlers.NewUserHandler(
		userRepo,
		employeeRepo,
		officeRepo,
		cfg.Office.DefaultLat,
		cfg.Office.DefaultLong,
	)
	attendanceHandler := handlers.NewAttendanceHandler(attendanceRepo, userRepo, wsHub)

	// Face verification
	facePhotoRepo := repository.NewFacePhotoRepository(db)
	faceVerificationHandler := handlers.NewFaceVerificationHandler(userRepo, facePhotoRepo)

	// Settings and transfer requests
	settingsRepo := repository.NewSettingsRepository(db)
	settingsHandler := handlers.NewSettingsHandler(settingsRepo)
	transferRepo := repository.NewTransferRequestRepository(db)
	transferHandler := handlers.NewTransferRequestHandler(transferRepo, userRepo)

	// Office Management
	officeHandler := handlers.NewOfficeHandler(officeRepo)
	
	// Employee Management
	employeeHandler := handlers.NewEmployeeHandler(employeeRepo, userRepo)

	// Kiosk Attendance
	kioskRepo := repository.NewKioskRepository(db)
	kioskHandler := handlers.NewKioskHandler(userRepo, attendanceRepo, settingsRepo, kioskRepo, facePhotoRepo, wsHub)

	// Setup Gin router
	router := gin.Default()

	// CORS configuration
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Static files
	router.Static("/uploads", "./uploads")
	router.Static("/assets", "./public/assets")
	router.StaticFile("/", "./public/index.html")
	router.StaticFile("/favicon.ico", "./public/favicon.ico")

	// Serve the rest of the frontend for SPA
	router.NoRoute(func(c *gin.Context) {
		if !strings.HasPrefix(c.Request.URL.Path, "/api") {
			c.File("./public/index.html")
		}
	})

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":     "healthy",
			"timestamp":  time.Now().UTC(),
			"ws_clients": wsHub.GetConnectedCount(),
		})
	})

	// API v1 routes
	api := router.Group("/api")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.Refresh)
			auth.POST("/logout", authHandler.Logout)
		}

		// Kiosk routes (public, no JWT required)
		kiosk := api.Group("/kiosk")
		{
			kiosk.POST("/scan", kioskHandler.ScanQR)
			kiosk.POST("/verify-face", kioskHandler.VerifyFace)
			kiosk.POST("/check-in", kioskHandler.KioskCheckIn)
			kiosk.POST("/check-out", kioskHandler.KioskCheckOut)
			kiosk.GET("/status/:employee_id", kioskHandler.GetKioskStatus)
			kiosk.POST("/admin-unlock", kioskHandler.AdminUnlock)
			kiosk.GET("/settings", kioskHandler.GetKioskSettings)
			kiosk.GET("/available", kioskHandler.GetAvailableKiosks)
			kiosk.POST("/pair", kioskHandler.PairKiosk)
			kiosk.GET("/employees-for-registration", kioskHandler.GetEmployeesForRegistration)
			kiosk.POST("/register-face", kioskHandler.RegisterFace)
			kiosk.GET("/company-settings", kioskHandler.GetCompanySettings)
		}

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(jwtManager))
		{
			// User routes
			users := protected.Group("/users")
			{
				users.GET("/me", userHandler.GetProfile)
				users.PUT("/face-embeddings", userHandler.UpdateFaceEmbeddings)
				users.GET("/sync-face", userHandler.SyncFaceData)
				users.PUT("/password", userHandler.ChangePassword)
				users.POST("/face-photos", faceVerificationHandler.UploadFacePhotos)
			}

			// Attendance routes
			attendance := protected.Group("/attendance")
			{
				attendance.POST("/check-in", attendanceHandler.CheckIn)
				attendance.POST("/check-out", attendanceHandler.CheckOut)
				attendance.GET("/history", attendanceHandler.GetHistory)
				attendance.GET("/today", attendanceHandler.GetTodayStatus)
			}

			// Transfer request routes (employee)
			users.POST("/transfer-requests", transferHandler.CreateRequest)
			users.GET("/transfer-requests", transferHandler.GetMyRequests)

			// Admin/HR routes
			admin := protected.Group("/admin")
			admin.Use(middleware.HRMiddleware())
			{
				// Dashboard stats
				admin.GET("/dashboard/stats", attendanceHandler.GetDashboardStats)

				admin.GET("/users", userHandler.GetAllUsers)
				admin.POST("/users", userHandler.CreateUser)
				admin.PUT("/users/:id", userHandler.UpdateUser)
				admin.POST("/users/:id/avatar", userHandler.UploadAvatar)
				admin.DELETE("/users/:id", userHandler.DeleteUser)
				admin.GET("/attendance/today", attendanceHandler.GetAllToday)

				// Face verification admin routes
				admin.GET("/face-verifications", faceVerificationHandler.GetPendingVerifications)
				admin.POST("/face-verifications/:id/approve", faceVerificationHandler.ApproveFaceVerification)
				admin.POST("/face-verifications/:id/reject", faceVerificationHandler.RejectFaceVerification)

				// Settings routes
				admin.GET("/settings", settingsHandler.GetAllSettings)
				admin.GET("/settings/:key", settingsHandler.GetSetting)
				admin.PUT("/settings/:key", settingsHandler.UpdateSetting)
				admin.POST("/settings/logo", settingsHandler.UploadLogo)

				// Transfer request admin routes
				admin.GET("/transfer-requests", transferHandler.GetPendingRequests)
				admin.POST("/transfer-requests/:id/approve", transferHandler.ApproveRequest)
				admin.POST("/transfer-requests/:id/reject", transferHandler.RejectRequest)

				// Office management routes
				admin.GET("/offices", officeHandler.GetAllOffices) // Can be public if needed
				admin.POST("/offices", officeHandler.CreateOffice)
				admin.PUT("/offices/:id", officeHandler.UpdateOffice)
				admin.DELETE("/offices/:id", officeHandler.DeleteOffice)

				// Kiosk routes
				admin.GET("/kiosks", kioskHandler.GetAllKiosks)
				admin.POST("/kiosks", kioskHandler.CreateKiosk)
				admin.PUT("/kiosks/:id", kioskHandler.UpdateKiosk)
				admin.DELETE("/kiosks/:id", kioskHandler.DeleteKiosk)
				admin.POST("/kiosks/:id/unpair", kioskHandler.UnpairKiosk)

				// Employee routes
				admin.GET("/employees", employeeHandler.GetAllEmployees)
				admin.POST("/employees", employeeHandler.CreateEmployee)
				admin.GET("/employees/:id", employeeHandler.GetEmployee)
				admin.PUT("/employees/:id", employeeHandler.UpdateEmployee)
				admin.DELETE("/employees/:id", employeeHandler.DeleteEmployee)
				admin.POST("/employees/:id/photo", employeeHandler.UploadPhoto)
				admin.POST("/employees/import", employeeHandler.ImportEmployees)
			}

			// Public/Employee Office routes
			protected.GET("/offices", officeHandler.GetAllOffices)
		}
	}

	// WebSocket route
	router.GET("/ws/dashboard", wsHub.HandleWebSocket)


	// Start server
	srv := &http.Server{
		Addr:    ":" + cfg.App.Port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Printf("🚀 Server starting on port %s", cfg.App.Port)
		log.Printf("📡 WebSocket available at ws://localhost:%s/ws/dashboard", cfg.App.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Give outstanding requests 5 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
