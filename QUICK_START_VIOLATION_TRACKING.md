# 🚨 Tracking Vi Phạm với Timestamp - Hướng Dẫn Nhanh

## ✅ Đã hoàn thành
Hệ thống giờ đây sẽ **ghi lại từng lần vi phạm** với **thời gian chính xác** khi sự kiện xảy ra.

---

## 📝 Các bước triển khai

### Bước 1: Chạy Migration SQL
1. Mở **Supabase Dashboard** → **SQL Editor**
2. Tạo **New Query**
3. Copy nội dung file **`ADD_VIOLATION_LOGS.sql`**
4. Paste vào editor và click **RUN**

### Bước 2: Test chức năng
1. Vào làm bài test bất kỳ
2. Thử các hành động:
   - **Chuyển tab** (Alt+Tab / Cmd+Tab)
   - **Click ra ngoài** trình duyệt
   - **Thoát fullscreen** (phím ESC)
3. Mỗi vi phạm sẽ được **ghi log tự động**

### Bước 3: Xem kết quả
1. Vào trang **Reports** (`/reports`)
2. Click vào một **submission** bất kỳ
3. Nếu có vi phạm → Xem section **"⚠️ Lịch sử Vi phạm"**

---

## 📊 Xem logs trong Supabase

### Cách 1: Table Editor
1. Mở **Supabase Dashboard**
2. Vào **Table Editor**
3. Chọn bảng **`test_violation_logs`**
4. Xem dữ liệu trực tiếp

### Cách 2: SQL Query
Sử dụng các query mẫu trong file **`QUERY_VIOLATION_LOGS.sql`**

**Ví dụ nhanh**:
```sql
-- Xem vi phạm của một thí sinh
SELECT 
  violation_reason,
  violated_at,
  TO_CHAR(violated_at, 'DD/MM/YYYY HH24:MI:SS') as thoi_gian
FROM test_violation_logs
WHERE access_code_id = 'YOUR_ACCESS_CODE_ID'
ORDER BY violated_at ASC;
```

---

## 🎯 Các loại vi phạm được tracking

| Loại vi phạm | Mô tả |
|--------------|-------|
| `Rời khỏi tab làm bài` | Chuyển tab hoặc minimize window |
| `Mất tập trung vào màn hình làm bài (Blur)` | Click ra ngoài browser |
| `Thoát chế độ toàn màn hình` | Thoát fullscreen (ESC) |
| `Phát hiện chụp màn hình` | Nhấn PrintScreen |

---

## 📂 Files quan trọng

| File | Mô tả |
|------|-------|
| `ADD_VIOLATION_LOGS.sql` | ⚡ **Migration SQL - CHẠY FILE NÀY TRƯỚC** |
| `SUMMARY_VIOLATION_TRACKING.md` | 📘 Tài liệu chi tiết đầy đủ |
| `QUERY_VIOLATION_LOGS.sql` | 🔍 Các query mẫu để phân tích |
| `MIGRATION_VIOLATION_LOGS.md` | 📋 Hướng dẫn migration |
| `app/tests/[id]/page.tsx` | 💻 Code ghi log vi phạm |
| `app/reports/[id]/page.tsx` | 📊 UI hiển thị lịch sử |

---

## ⚡ Quick Start (3 phút)

```bash
# 1. Chạy migration
# → Mở Supabase SQL Editor
# → Copy ADD_VIOLATION_LOGS.sql
# → Run

# 2. Test ngay
# → Vào làm bài test
# → Chuyển tab → Vi phạm được ghi log

# 3. Xem kết quả
# → /reports → Click submission → Xem "Lịch sử Vi phạm"
```

---

## 💡 Lợi ích

✅ **Biết chính xác** thời gian vi phạm  
✅ **Chi tiết từng sự kiện** - Mỗi vi phạm là một record  
✅ **Phân tích hành vi** - Tìm pattern gian lận  
✅ **Bằng chứng cụ thể** - Dữ liệu không thể chối cãi  
✅ **Báo cáo dễ dàng** - Export và phân tích  

---

## 🆘 Cần trợ giúp?

📖 Đọc file **`SUMMARY_VIOLATION_TRACKING.md`** để biết chi tiết đầy đủ.

---

**Tóm lại**: Chạy `ADD_VIOLATION_LOGS.sql` → Test → Xem report! 🎉
