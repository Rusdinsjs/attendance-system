-- 001_init.sql
-- Attendance System Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table with face embeddings
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('employee', 'admin', 'hr')),
    face_embeddings JSONB,  -- Array of 5 face vectors [[-0.1, 0.2, ...], [...], ...]
    office_lat DOUBLE PRECISION NOT NULL DEFAULT -6.200000,
    office_long DOUBLE PRECISION NOT NULL DEFAULT 106.816666,
    allowed_radius INT DEFAULT 50,  -- meters
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance logs
CREATE TABLE IF NOT EXISTS attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_in_lat DOUBLE PRECISION,
    check_in_long DOUBLE PRECISION,
    check_out_lat DOUBLE PRECISION,
    check_out_long DOUBLE PRECISION,
    device_info VARCHAR(255),
    is_late BOOLEAN DEFAULT FALSE,
    is_mock_location BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refresh tokens for JWT
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(512) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Office locations (untuk future multi-office support)
CREATE TABLE IF NOT EXISTS offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius INT DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendances_user_id ON attendances(user_id);
CREATE INDEX IF NOT EXISTS idx_attendances_check_in_time ON attendances(check_in_time);
CREATE INDEX IF NOT EXISTS idx_attendances_created_at ON attendances(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Insert default admin user (password: admin123)
INSERT INTO users (employee_id, name, email, password_hash, role, office_lat, office_long)
VALUES (
    'ADMIN001',
    'System Admin',
    'admin@attendance.local',
    '$2a$10$z2Nse8u5LFBf8UAOcAfMF.zYzgE59/E5xc99xluNTnhwxVtf5R8ha',  -- bcrypt hash of 'admin123'
    'admin',
    -6.200000,
    106.816666
) ON CONFLICT (email) DO NOTHING;
