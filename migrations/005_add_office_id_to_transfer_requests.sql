-- Migration: Add office ID columns to transfer requests
-- This fixes the bug where office_id was not being updated on transfer approval

ALTER TABLE office_transfer_requests 
ADD COLUMN IF NOT EXISTS current_office_id UUID REFERENCES offices(id),
ADD COLUMN IF NOT EXISTS requested_office_id UUID REFERENCES offices(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transfer_requests_current_office ON office_transfer_requests(current_office_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_requested_office ON office_transfer_requests(requested_office_id);
