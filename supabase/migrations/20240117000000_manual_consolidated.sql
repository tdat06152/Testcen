-- COPY TOÀN BỘ NỘI DUNG DƯỚI ĐÂY VÀ CHẠY TRONG SUPABASE SQL EDITOR

-- 1. Bảng tests: Cho phép ai cũng xem được bài test (để load title, settings)
alter table tests enable row level security;
create policy "Public view tests" on tests
for select using (true);

-- 2. Bảng questions: Cho phép ai cũng xem câu hỏi
alter table questions enable row level security;
create policy "Public view questions" on questions
for select using (true);

-- 3. Bảng answers: Cho phép ai cũng xem đáp án
alter table answers enable row level security;
create policy "Public view answers" on answers
for select using (true);

-- 4. Bảng test_access_codes: Cho phép tra cứu và cập nhật (đánh dấu đã dùng)
alter table test_access_codes enable row level security;
create policy "Public view access codes" on test_access_codes
for select using (true);

create policy "Public update access codes" on test_access_codes
for update using (true);

-- 5. Bảng test_submissions: Cho phép nộp bài (insert) và xem lại kết quả (select)
alter table test_submissions enable row level security;
create policy "Public insert submissions" on test_submissions
for insert with check (true);

create policy "Public view submissions" on test_submissions
for select using (true);

-- 6. Bảng test_submission_answers: Cho phép lưu chi tiết bài làm
alter table test_submission_answers enable row level security;
create policy "Public insert submission answers" on test_submission_answers
for insert with check (true);

create policy "Public view submission answers" on test_submission_answers
for select using (true);

-- 7. Storage (nếu có ảnh): Cho phép xem ảnh public
-- (Bạn cần tạo bucket 'test-assets' và 'question-images' public trong menu Storage của Supabase)
-- Add violation_count column to test_submissions
ALTER TABLE test_submissions 
ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;
