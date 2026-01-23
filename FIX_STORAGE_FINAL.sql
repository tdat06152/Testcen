-- ==============================================================================
-- FIX STORAGE PERMISSIONS (VỀ LẠI test-assets)
-- ==============================================================================

-- 1. Insert bucket (nếu chưa có)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('test-assets', 'test-assets', true, null, null)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Cho phép mọi người XEM DANH SÁCH bucket
DROP POLICY IF EXISTS "Public_View_Buckets" ON storage.buckets;
CREATE POLICY "Public_View_Buckets" ON storage.buckets FOR SELECT TO public USING ( true );

-- 3. Reset & Cấp quyền Upload/Xem file cho Authenticated User
DROP POLICY IF EXISTS "Authenticated_All_Access_TestAssets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated_All_Access_QuestionImages" ON storage.objects; -- Xóa cái cũ đi cho sạch

CREATE POLICY "Authenticated_All_Access_TestAssets"
ON storage.objects FOR ALL TO authenticated
USING ( bucket_id = 'test-assets' )
WITH CHECK ( bucket_id = 'test-assets' );

-- 4. Cấp quyền Xem file cho Public
DROP POLICY IF EXISTS "Public_Read_TestAssets" ON storage.objects;
DROP POLICY IF EXISTS "Public_Read_QuestionImages" ON storage.objects; -- Xóa cái cũ đi cho sạch

CREATE POLICY "Public_Read_TestAssets"
ON storage.objects FOR SELECT TO public
USING ( bucket_id = 'test-assets' );
