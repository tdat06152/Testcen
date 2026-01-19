-- Add violation_count column to test_submissions
ALTER TABLE test_submissions 
ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;
