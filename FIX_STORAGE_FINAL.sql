-- ==============================================================================
-- FIX STORAGE PERMISSIONS (FINAL - TRIỆT ĐỂ)
-- ==============================================================================

-- 1. Đảm bảo Bucket tồn tại
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('question-images', 'question-images', true, null, null)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Xóa sạch mọi Policy cũ (Objects & Buckets) để tránh conflict
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated_All_Access_QuestionImages" ON storage.objects;
DROP POLICY IF EXISTS "Public_Read_QuestionImages" ON storage.objects;
DROP POLICY IF EXISTS "Public_View_Buckets" ON storage.buckets;

-- 3. Cấp quyền xem BUCKET cho tất cả mọi người (Fix lỗi "Bucket not found" do không nhìn thấy bucket)
CREATE POLICY "Public_View_Buckets"
ON storage.buckets
FOR SELECT
TO public
USING ( true );

-- 4. Cấp quyền TOÀN DIỆN cho người đã đăng nhập (Upload, Sửa, Xóa ảnh)
CREATE POLICY "Authenticated_All_Access_QuestionImages"
ON storage.objects
FOR ALL
TO authenticated
USING ( bucket_id = 'question-images' )
WITH CHECK ( bucket_id = 'question-images' );

-- 5. Cấp quyền XEM ảnh cho tất cả mọi người (kể cả khách)
CREATE POLICY "Public_Read_QuestionImages"
ON storage.objects
FOR SELECT
TO public
USING ( bucket_id = 'question-images' );
