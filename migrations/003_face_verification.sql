-- 003_face_verification.sql
-- Add verification status to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_verification_status VARCHAR(20) DEFAULT 'none';
-- Values: 'none', 'pending', 'verified', 'rejected'

-- Table for temporary face photos (pending verification)
CREATE TABLE IF NOT EXISTS face_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_path VARCHAR(500) NOT NULL,
    photo_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_photos_user ON face_photos(user_id);
