-- ==============================================================================
-- SETUP BUCKET MỚI: "bank" 
-- ==============================================================================

-- 1. Tạo bucket "bank" và đặt là PUBLIC
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank', 'bank', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Xóa các policy cũ liên quan đến bucket "bank" để tránh xung đột
DROP POLICY IF EXISTS "Public View Bank Bucket" ON storage.buckets;
DROP POLICY IF EXISTS "Public Access Bank Objects" ON storage.objects;
DROP POLICY IF EXISTS "Admin Access Bank Objects" ON storage.objects;

-- 3. Cấp quyền XEM danh sách bucket cho mọi người
CREATE POLICY "Public View Bank Bucket" 
ON storage.buckets FOR SELECT 
TO public 
USING (name = 'bank');

-- 4. Cấp quyền TỰ DO cho tất cả mọi người trong bucket "bank" 
-- (Để đảm bảo local luôn chạy được, không lo về session/login)
CREATE POLICY "Full Access Bank Objects" 
ON storage.objects 
FOR ALL 
TO public 
USING (bucket_id = 'bank') 
WITH CHECK (bucket_id = 'bank');

-- 5. Cấp quyền ở mức database cho chắc chắn
GRANT ALL ON storage.objects TO anon, authenticated, postgres, service_role;
GRANT ALL ON storage.buckets TO anon, authenticated, postgres, service_role;
