-- ==============================================================================
-- FIX QUESTION BANK RLS (FORCE PERMISSIONS)
-- ==============================================================================

-- 1. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admin all categories" ON question_bank_categories;
DROP POLICY IF EXISTS "Admin all bank questions" ON question_bank;
DROP POLICY IF EXISTS "Admin all bank answers" ON question_bank_answers;

-- 2. Re-create policies with explicit WITH CHECK (true)
-- This ensures that INSERT and UPDATE operations are permitted for documented users.

CREATE POLICY "Admin all categories" 
ON question_bank_categories 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Admin all bank questions" 
ON question_bank 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Admin all bank answers" 
ON question_bank_answers 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. In case you want to test while NOT logged in (BE CAREFUL - ONLY FOR LOCAL TESTING)
-- If you are still getting the error on localhost, it might be because the frontend
-- is not sending the Auth token correctly. You can uncomment these to bypass RLS:

-- CREATE POLICY "Public all categories" ON question_bank_categories FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Public all bank questions" ON question_bank FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Public all bank answers" ON question_bank_answers FOR ALL TO anon USING (true) WITH CHECK (true);
