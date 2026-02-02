-- Fix foreign key constraint for test_submission_answers -> questions
-- Chạy file này để fix lỗi không xoá được bài test (do vướng submissions)

-- 1. Drop constraint cũ (nếu có)
ALTER TABLE test_submission_answers
DROP CONSTRAINT IF EXISTS test_submission_answers_question_id_fkey;

-- 2. Add constraint mới với ON DELETE SET NULL
-- Khi câu hỏi bị xoá, dòng trong submission vẫn còn nhưng question_id sẽ thành NULL
ALTER TABLE test_submission_answers
ADD CONSTRAINT test_submission_answers_question_id_fkey
FOREIGN KEY (question_id)
REFERENCES questions(id)
ON DELETE SET NULL;
