# Migration: Thêm Tracking Chi Tiết Vi Phạm

## Mô tả
Tính năng này cho phép ghi lại **từng lần vi phạm** với **thời gian chính xác** khi vi phạm xảy ra.

## Các thay đổi

### 1. Database
- **Bảng mới**: `test_violation_logs` - lưu lịch sử chi tiết từng vi phạm
- **Columns**:
  - `id`: UUID primary key
  - `submission_id`: Link với submission (nullable vì có thể chưa nộp bài)
  - `test_id`: ID của bài test
  - `access_code_id`: ID của access code đang dùng
  - `violation_reason`: Lý do vi phạm (TEXT)
  - `violated_at`: Thời điểm vi phạm xảy ra (TIMESTAMPTZ)
  - `created_at`: Thời điểm tạo record

### 2. Code Changes
- File: `app/tests/[id]/page.tsx`
- Hàm `handleViolation` giờ đã **async** và insert log vào database mỗi khi phát hiện vi phạm

## Cách chạy Migration

### Bước 1: Chạy SQL trong Supabase Dashboard
1. Mở Supabase Dashboard → SQL Editor
2. Copy nội dung file `ADD_VIOLATION_LOGS.sql`
3. Paste và Run

### Bước 2: Test
1. Vào làm bài test
2. Thử chuyển tab hoặc thoát fullscreen
3. Kiểm tra bảng `test_violation_logs` trong Supabase → Table Editor

## Xem Logs Vi Phạm

### Query Supabase
```sql
-- Xem tất cả vi phạm của một test
SELECT 
  violation_reason,
  violated_at,
  test_id,
  access_code_id
FROM test_violation_logs
WHERE test_id = 'YOUR_TEST_ID'
ORDER BY violated_at DESC;

-- Xem vi phạm của một thí sinh cụ thể
SELECT 
  violation_reason,
  violated_at
FROM test_violation_logs
WHERE access_code_id = 'YOUR_ACCESS_CODE_ID'
ORDER BY violated_at ASC;
```

## Lợi ích
- ✅ Biết chính xác thời gian vi phạm xảy ra
- ✅ Có thể phân tích hành vi gian lận
- ✅ Có bằng chứng cụ thể cho từng vi phạm
- ✅ Có thể tạo báo cáo chi tiết về vi phạm

## TODO (Tùy chọn)
- [ ] Tạo trang admin để xem lịch sử vi phạm
- [ ] Xuất báo cáo vi phạm ra Excel/PDF
- [ ] Thêm chart thống kê vi phạm theo thời gian
