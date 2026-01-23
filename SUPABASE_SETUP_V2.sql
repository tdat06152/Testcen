-- ==============================================================================
-- SUPABASE SETUP SCRIPT (MỚI NHẤT)
-- Tổng hợp từ toàn bộ lịch sử chỉnh sửa
-- Dùng để tạo mới project từ đầu.
-- ==============================================================================

-- 1. Enable UUID extension (thường mặc định có, nhưng cứ chạy cho chắc)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TẠO BẢNG (TABLES)
-- ==============================================================================

-- Bảng: tests
CREATE TABLE IF NOT EXISTS tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID DEFAULT auth.uid(), -- Link tới user tạo đề (admin)
  title TEXT NOT NULL,
  description TEXT,
  pass_score INTEGER DEFAULT 0,
  time_limit INTEGER DEFAULT 0, -- 0: false, 1: true
  duration_minutes INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  success_message TEXT,
  fail_message TEXT,
  allow_review BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'draft', -- 'draft' | 'published'
  max_violations INTEGER DEFAULT 0 -- Số lần vi phạm tối đa (0 = k giới hạn)
);

-- Bảng: questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT, -- 'single' | 'multiple' | 'essay'
  correct_answer TEXT, -- Dùng cho logic cũ hoặc loại câu hỏi đơn giản
  options TEXT[], -- Mảng các ID hoặc label option
  image_url TEXT, -- (Legacy) link ảnh cũ
  images TEXT[] DEFAULT '{}' -- Mảng link ảnh (mới)
);

-- Bảng: answers
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  content TEXT,
  is_correct BOOLEAN DEFAULT FALSE,
  image_url TEXT, -- (Legacy)
  images TEXT[] DEFAULT '{}' -- Mảng link ảnh (mới)
);

-- Bảng: test_access_codes
CREATE TABLE IF NOT EXISTS test_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ
);

-- Bảng: test_submissions
CREATE TABLE IF NOT EXISTS test_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  access_code_id UUID REFERENCES test_access_codes(id),
  candidate_name TEXT,
  score_percent NUMERIC,
  correct_count INTEGER,
  total_count INTEGER,
  passed BOOLEAN,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  violation_count INTEGER DEFAULT 0
);

-- Bảng: test_submission_answers
CREATE TABLE IF NOT EXISTS test_submission_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  submission_id UUID REFERENCES test_submissions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  selected_answer_ids TEXT[], -- Lưu mảng UUID của answers đã chọn
  essay_text TEXT,
  is_correct BOOLEAN
);

-- Bảng: profiles (Quản lý role Admin/User)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'admin', -- Mặc định là admin để bạn có quyền ngay khi tạo account
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ==============================================================================
-- 3. ENABLE RLS (Row Level Security)
-- Bắt buộc bật để bảo mật data
-- ==============================================================================

ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 4. TẠO POLICIES (Quyền truy cập)
-- ==============================================================================

-- Xóa các policy cũ nếu đã tồn tại để tránh lỗi khi chạy lại script
DO $$ 
BEGIN
    -- Admin policies
    DROP POLICY IF EXISTS "Admin all tests" ON tests;
    DROP POLICY IF EXISTS "Admin all questions" ON questions;
    DROP POLICY IF EXISTS "Admin all answers" ON answers;
    DROP POLICY IF EXISTS "Admin all access_codes" ON test_access_codes;
    DROP POLICY IF EXISTS "Admin all submissions" ON test_submissions;
    DROP POLICY IF EXISTS "Admin all sub_answers" ON test_submission_answers;
    DROP POLICY IF EXISTS "Admin all profiles" ON profiles;

    -- Public policies
    DROP POLICY IF EXISTS "Public view tests" ON tests;
    DROP POLICY IF EXISTS "Public view questions" ON questions;
    DROP POLICY IF EXISTS "Public view answers" ON answers;
    DROP POLICY IF EXISTS "Public view access codes" ON test_access_codes;
    DROP POLICY IF EXISTS "Public update access codes" ON test_access_codes;
    DROP POLICY IF EXISTS "Public insert submissions" ON test_submissions;
    DROP POLICY IF EXISTS "Public view submissions" ON test_submissions;
    DROP POLICY IF EXISTS "Public insert sub_answers" ON test_submission_answers;
    DROP POLICY IF EXISTS "Public view sub_answers" ON test_submission_answers;
END $$;

-- 4.1. QUYỀN ADMIN (Authenticated Users)
-- Admin được làm mọi thứ (ALL) với tất cả các bảng

CREATE POLICY "Admin all tests" ON tests FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin all questions" ON questions FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin all answers" ON answers FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin all access_codes" ON test_access_codes FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin all submissions" ON test_submissions FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin all sub_answers" ON test_submission_answers FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin all profiles" ON profiles FOR ALL TO authenticated USING (true);


-- 4.2. QUYỀN PUBLIC / ANONYMOUS (Người làm bài)

-- Tests: Chỉ được xem (để load thông tin bài test)
CREATE POLICY "Public view tests" ON tests FOR SELECT TO anon USING (true);

-- Questions: Chỉ được xem (để load câu hỏi)
CREATE POLICY "Public view questions" ON questions FOR SELECT TO anon USING (true);

-- Answers: Chỉ được xem (để load đáp án hiển thị)
CREATE POLICY "Public view answers" ON answers FOR SELECT TO anon USING (true);

-- Access Codes:
-- Xem: Để kiểm tra mã code có hợp lệ không
CREATE POLICY "Public view access codes" ON test_access_codes FOR SELECT TO anon USING (true);
-- Update: Để đánh dấu is_used = true sau khi vào thi
CREATE POLICY "Public update access codes" ON test_access_codes FOR UPDATE TO anon USING (true);

-- Submissions:
-- Insert: Để nộp bài
CREATE POLICY "Public insert submissions" ON test_submissions FOR INSERT TO anon WITH CHECK (true);
-- Select: Để xem lại kết quả vừa nộp
CREATE POLICY "Public view submissions" ON test_submissions FOR SELECT TO anon USING (true);

-- Submission Answers (Chi tiết bài làm):
-- Insert: Lưu chi tiết từng câu
CREATE POLICY "Public insert sub_answers" ON test_submission_answers FOR INSERT TO anon WITH CHECK (true);
-- Select: Xem lại chi tiết (nếu tính năng review được bật)
CREATE POLICY "Public view sub_answers" ON test_submission_answers FOR SELECT TO anon USING (true);


-- ==============================================================================
-- 5. AUTH TRIGGER (Tự động tạo profile khi đăng ký)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'admin'); -- Để mặc định admin cho tài khoản đầu tiên bạn tạo
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- 6. STORAGE BUCKETS
-- Hướng dẫn tạo bucket (Phải làm thủ công hoặc chạy script nếu có extension)
-- ==============================================================================

-- Vào menu Storage trên Supabase Dashboard:
-- 1. Tạo bucket mới tên: "question-images"
-- 2. Đặt là "Public" bucket.
-- 3. Tạo bucket mới tên: "test-assets" (nếu cần)
-- 4. Đặt là "Public" bucket.

-- Policy cho Storage (SQL tham khảo, thường set trên UI dễ hơn):
-- insert into storage.buckets (id, name, public) values ('question-images', 'question-images', true);
-- create policy "Public Access" on storage.objects for select using ( bucket_id = 'question-images' );
-- create policy "Auth Upload" on storage.objects for insert to authenticated with check ( bucket_id = 'question-images' );
