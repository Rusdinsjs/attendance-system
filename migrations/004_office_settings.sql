-- 004_office_settings.sql
-- Global settings table for configurable values
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description VARCHAR(200),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value, description) VALUES
    ('face_threshold', '0.6', 'Face matching threshold (0.0-1.0, lower=stricter)'),
    ('min_gps_accuracy', '20', 'Minimum GPS accuracy in meters')
ON CONFLICT (key) DO NOTHING;

-- Office transfer requests table
CREATE TABLE IF NOT EXISTS office_transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_office_lat FLOAT NOT NULL,
    current_office_long FLOAT NOT NULL,
    requested_office_lat FLOAT NOT NULL,
    requested_office_long FLOAT NOT NULL,
    requested_radius INT DEFAULT 50,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_user ON office_transfer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON office_transfer_requests(status);
