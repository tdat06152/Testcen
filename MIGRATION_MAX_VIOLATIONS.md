# Hướng dẫn chạy Migration cho Max Violations

## Bước 1: Thêm cột max_violations vào bảng tests

Truy cập Supabase Dashboard của bạn:
1. Vào https://supabase.com/dashboard
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng ở sidebar bên trái)
4. Tạo một query mới và paste đoạn SQL sau:

```sql
-- Add max_violations column to tests table
-- This allows setting a maximum number of violations (tab switch, screenshot, minimize) per test
-- Default is 0 (unlimited violations allowed)
ALTER TABLE tests 
ADD COLUMN IF NOT EXISTS max_violations INTEGER DEFAULT 0;

COMMENT ON COLUMN tests.max_violations IS 'Maximum number of violations allowed. 0 = unlimited, >0 = lock test after exceeding';
```

5. Nhấn **Run** hoặc `Cmd+Enter` để chạy

## Bước 2: Kiểm tra

Chạy query sau để kiểm tra cột đã được thêm:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tests' AND column_name = 'max_violations';
```

Bạn sẽ thấy kết quả:
- column_name: max_violations
- data_type: integer
- column_default: 0

## Hoặc sử dụng file SQL có sẵn

File `ADD_MAX_VIOLATIONS.sql` đã được tạo trong thư mục gốc của project. Bạn có thể:
1. Mở file này
2. Copy nội dung
3. Paste vào SQL Editor của Supabase
4. Run

---

**Lưu ý**: Migration này an toàn và không ảnh hưởng đến dữ liệu hiện có. Tất cả các test hiện tại sẽ có `max_violations = 0` (không giới hạn).
