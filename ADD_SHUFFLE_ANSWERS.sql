-- Add shuffle_answers column to tests table
-- Allows randomizing the order of answer options for each question

ALTER TABLE tests 
ADD COLUMN IF NOT EXISTS shuffle_answers BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tests.shuffle_answers IS 'Nếu true, thứ tự các đáp án sẽ bị xáo trộn khi thí sinh làm bài';
