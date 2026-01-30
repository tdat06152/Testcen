-- ==============================================================================
-- QUESTION BANK SETUP
-- ==============================================================================

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS question_bank_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  category_id UUID REFERENCES question_bank_categories(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL, -- 'single' | 'multiple' | 'essay'
  images TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS question_bank_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  question_id UUID REFERENCES question_bank(id) ON DELETE CASCADE,
  content TEXT,
  is_correct BOOLEAN DEFAULT FALSE,
  images TEXT[] DEFAULT '{}'
);

-- 2. Enable RLS
ALTER TABLE question_bank_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_answers ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
-- Only authenticated users (admins) can access the question bank
CREATE POLICY "Admin all categories" ON question_bank_categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin all bank questions" ON question_bank FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin all bank answers" ON question_bank_answers FOR ALL TO authenticated USING (true);

-- No public access to question bank
-- (Empty policies for anon means no access)
