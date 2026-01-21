-- Add images column to questions and answers
ALTER TABLE questions ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
ALTER TABLE answers ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- Optional: Migrate existing image_url data for questions
UPDATE questions 
SET images = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND images = '{}';

-- Optional: Migrate existing image_url data for answers
UPDATE answers 
SET images = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND images = '{}';
