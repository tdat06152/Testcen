-- Add max_violations column to tests table
-- This allows setting a maximum number of violations (tab switch, screenshot, minimize) per test
-- Default is 0 (unlimited violations allowed)
ALTER TABLE tests 
ADD COLUMN IF NOT EXISTS max_violations INTEGER DEFAULT 0;

COMMENT ON COLUMN tests.max_violations IS 'Maximum number of violations allowed. 0 = unlimited, >0 = lock test after exceeding';
