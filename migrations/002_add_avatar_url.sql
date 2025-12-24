-- 002_add_avatar_url.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);
