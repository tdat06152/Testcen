-- ==============================================================================
-- FIX STORAGE RLS FOR ALL BUCKETS (OPEN PERMISSIONS) - VERSION 2
-- ==============================================================================

-- 1. Đảm bảo các bucket tồn tại và là PUBLIC
INSERT INTO storage.buckets (id, name, public)
VALUES ('test-assets', 'test-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Xóa sạch TẤT CẢ policy liên quan đến storage.objects bằng cách lặp qua từng cái
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON storage.objects';
    END LOOP;
END $$;

-- 3. Tạo policy mở rộng: Cho phép Authenticated User làm MỌI THỨ với storage
CREATE POLICY "Allow_All_For_Authenticated"
ON storage.objects
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Tạo policy mở rộng: Cho phép Public XEM tất cả file
CREATE POLICY "Allow_Public_Read"
ON storage.objects
FOR SELECT
TO public
USING (true);

-- 5. Cho phép mọi người xem danh sách bucket
DROP POLICY IF EXISTS "Public_View_Buckets" ON storage.buckets;
CREATE POLICY "Public_View_Buckets" ON storage.buckets FOR SELECT TO public USING (true);
