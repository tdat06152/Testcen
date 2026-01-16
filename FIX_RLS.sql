-- Xoá các policy cũ để tránh xung đột
drop policy if exists "Public view tests" on tests;
drop policy if exists "Public view questions" on questions;
drop policy if exists "Public view answers" on answers;
drop policy if exists "Public view access codes" on test_access_codes;
drop policy if exists "Public update access codes" on test_access_codes;
drop policy if exists "Public insert submissions" on test_submissions;
drop policy if exists "Public view submissions" on test_submissions;
drop policy if exists "Public insert submission answers" on test_submission_answers;
drop policy if exists "Public view submission answers" on test_submission_answers;

-- Đảm bảo RLS đã bật
alter table tests enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table test_access_codes enable row level security;
alter table test_submissions enable row level security;
alter table test_submission_answers enable row level security;

-- ==================================================
-- 1. QUYỀN ADMIN (Người tạo đề - Authenticated)
-- ==================================================
-- Admin được làm TẤT CẢ (xem, thêm, sửa, xoá) trên mọi bảng
create policy "Admin all tests" on tests for all to authenticated using (true);
create policy "Admin all questions" on questions for all to authenticated using (true);
create policy "Admin all answers" on answers for all to authenticated using (true);
create policy "Admin all codes" on test_access_codes for all to authenticated using (true);
create policy "Admin all submissions" on test_submissions for all to authenticated using (true);
create policy "Admin all sub_answers" on test_submission_answers for all to authenticated using (true);


-- ==================================================
-- 2. QUYỀN USER (Người làm bài - Anon/Public)
-- ==================================================

-- Tests: Chỉ được xem
create policy "Public view tests" on tests for select to anon using (true);

-- Questions: Chỉ được xem
create policy "Public view questions" on questions for select to anon using (true);

-- Answers: Chỉ được xem
create policy "Public view answers" on answers for select to anon using (true);

-- Access Codes: Xem (để check mã) và Cập nhật (để đánh dấu text đã dùng)
create policy "Public view access codes" on test_access_codes for select to anon using (true);
create policy "Public update access codes" on test_access_codes for update to anon using (true);

-- Submissions: Nộp bài (Insert) và Xem kết quả (Select)
create policy "Public insert submissions" on test_submissions for insert to anon with check (true);
create policy "Public view submissions" on test_submissions for select to anon using (true);

-- Chi tiết bài làm: Nộp (Insert) và Xem (Select)
create policy "Public insert sub_answers" on test_submission_answers for insert to anon with check (true);
create policy "Public view sub_answers" on test_submission_answers for select to anon using (true);
