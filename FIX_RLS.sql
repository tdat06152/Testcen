
-- 1. DROP các policy cũ liên quan đến questions đang gây lỗi
DROP POLICY IF EXISTS "Admin all questions" ON questions;
DROP POLICY IF EXISTS "Public view questions" ON questions;

-- 2. TẠO LẠI policy cho questions
-- Admin (authenticated) được quyền ALL (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admin all questions" 
ON questions 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Public (anon) chỉ được xem (SELECT)
CREATE POLICY "Public view questions" 
ON questions 
FOR SELECT 
TO anon 
USING (true);

-- 3. Đảm bảo bảng tests cũng ổn định (vì questions tham chiếu tests)
DROP POLICY IF EXISTS "Admin all tests" ON tests;
CREATE POLICY "Admin all tests" 
ON tests 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
