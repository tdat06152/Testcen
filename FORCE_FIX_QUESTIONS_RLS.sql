-- FORCE FIX RLS FOR QUESTIONS
-- Chạy script này để sửa triệt để lỗi "new row violates row-level security policy for table questions"

BEGIN;

-- 1. Disable RLS tạm thời để clean up
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;

-- 2. Xóa TẤT CẢ các policy cũ (để tránh conflict)
DROP POLICY IF EXISTS "Admin all questions" ON questions;
DROP POLICY IF EXISTS "Public view questions" ON questions;
DROP POLICY IF EXISTS "Authenticated insert questions" ON questions;
DROP POLICY IF EXISTS "Authenticated update questions" ON questions;
DROP POLICY IF EXISTS "Authenticated delete questions" ON questions;
DROP POLICY IF EXISTS "Authenticated select questions" ON questions;

-- 3. Tạo Policy mới: Authenticated Users (Admin) được toàn quyền (ALL)
-- USING (true) va WITH CHECK (true) nghia la: cu login roi la duoc lam tat ca.
CREATE POLICY "Enable All Access for Authenticated Users"
ON questions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Tạo Policy cho Public (Anon): Chỉ được xem (SELECT)
CREATE POLICY "Enable Read Access for Public Users"
ON questions
FOR SELECT
TO anon
USING (true);

-- 5. Bật lại RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Kiem tra lai bang Answers luon cho chac
ALTER TABLE answers DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin all answers" ON answers;
DROP POLICY IF EXISTS "Public view answers" ON answers;

CREATE POLICY "Enable All Access for Authenticated Users"
ON answers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable Read Access for Public Users"
ON answers
FOR SELECT
TO anon
USING (true);

ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

COMMIT;
