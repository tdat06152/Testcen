-- ==============================================================================
-- FORCE OPEN QUESTION BANK (Bypass RLS for local development)
-- ==============================================================================

-- 1. Disable RLS for the bank tables (Fastest way to solve RLS errors on Local)
ALTER TABLE question_bank_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_answers DISABLE ROW LEVEL SECURITY;

-- 2. Grant all permissions to everyone (Backup in case RLS is re-enabled)
GRANT ALL ON question_bank_categories TO anon, authenticated, postgres, service_role;
GRANT ALL ON question_bank TO anon, authenticated, postgres, service_role;
GRANT ALL ON question_bank_answers TO anon, authenticated, postgres, service_role;

-- 3. Also grant sequence permissions if they exist (though UUID doesn't use them)

-- 4. Fix potential user_id issues (make it optional)
ALTER TABLE question_bank ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE question_bank_categories ALTER COLUMN user_id DROP NOT NULL;

-- 5. If you want to keep RLS ENABLED but just make it "OPEN":
/*
ALTER TABLE question_bank_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public all categories" ON question_bank_categories;
CREATE POLICY "Public all categories" ON question_bank_categories FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public all questions" ON question_bank;
CREATE POLICY "Public all questions" ON question_bank FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE question_bank_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public all answers" ON question_bank_answers;
CREATE POLICY "Public all answers" ON question_bank_answers FOR ALL TO public USING (true) WITH CHECK (true);
*/
