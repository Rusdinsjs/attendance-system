package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application
type Config struct {
	App      AppConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	Office   OfficeConfig
}

type AppConfig struct {
	Env  string
	Port string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

type OfficeConfig struct {
	DefaultLat    float64
	DefaultLong   float64
	DefaultRadius int
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if exists (ignore error for production)
	_ = godotenv.Load()

	accessExpiry, _ := time.ParseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"))
	refreshExpiry, _ := time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h")) // 7 days

	defaultLat, _ := strconv.ParseFloat(getEnv("DEFAULT_OFFICE_LAT", "-6.200000"), 64)
	defaultLong, _ := strconv.ParseFloat(getEnv("DEFAULT_OFFICE_LONG", "106.816666"), 64)
	defaultRadius, _ := strconv.Atoi(getEnv("DEFAULT_ALLOWED_RADIUS", "50"))

	return &Config{
		App: AppConfig{
			Env:  getEnv("APP_ENV", "development"),
			Port: getEnv("PORT", "8080"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "attendance"),
			Password: getEnv("DB_PASSWORD", "attendance_secret"),
			Name:     getEnv("DB_NAME", "attendance_db"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       0,
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", "default-secret-change-in-production"),
			AccessExpiry:  accessExpiry,
			RefreshExpiry: refreshExpiry,
		},
		Office: OfficeConfig{
			DefaultLat:    defaultLat,
			DefaultLong:   defaultLong,
			DefaultRadius: defaultRadius,
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
