-- ==============================================================================
-- FIX STORAGE PERMISSIONS (CHẠY CÁI NÀY ĐỂ SỬA LỖI BUCKET NOT FOUND)
-- ==============================================================================

-- 1. Đảm bảo Bucket tồn tại trong Database (dù UI đã hiện, nhưng cứ chạy lệnh này để chắc chắn)
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Xóa sạch các policy cũ có thể gây xung đột
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated_All_Access_QuestionImages" ON storage.objects;
DROP POLICY IF EXISTS "Public_Read_QuestionImages" ON storage.objects;

-- 3. Cấp quyền TOÀN DIỆN cho người đã đăng nhập (Upload, Sửa, Xóa)
CREATE POLICY "Authenticated_All_Access_QuestionImages"
ON storage.objects
FOR ALL
TO authenticated
USING ( bucket_id = 'question-images' )
WITH CHECK ( bucket_id = 'question-images' );

-- 4. Cấp quyền XEM cho tất cả mọi người (kể cả chưa đăng nhập - để hiển thị ảnh khi làm bài)
CREATE POLICY "Public_Read_QuestionImages"
ON storage.objects
FOR SELECT
TO public
USING ( bucket_id = 'question-images' );
