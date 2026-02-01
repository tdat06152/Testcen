-- Nâng cấp ngân hàng câu hỏi và liên kết dữ liệu
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'Easy'; -- 'Easy' | 'Medium' | 'Hard'
ALTER TABLE questions ADD COLUMN IF NOT EXISTS bank_question_id UUID REFERENCES question_bank(id) ON DELETE SET NULL;
