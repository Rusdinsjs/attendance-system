-- 00X_add_paired_to_kiosks.sql
-- Add is_paired column to kiosks table

ALTER TABLE kiosks
ADD COLUMN is_paired BOOLEAN DEFAULT FALSE;
