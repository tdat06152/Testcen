# ✅ Checklist: Triển khai Violation Tracking

## 📋 Bước 1: Database Setup

- [ ] **1.1** Mở Supabase Dashboard
- [ ] **1.2** Vào SQL Editor
- [ ] **1.3** Tạo New Query
- [ ] **1.4** Copy nội dung file `ADD_VIOLATION_LOGS.sql`
- [ ] **1.5** Paste vào editor
- [ ] **1.6** Click **RUN**
- [ ] **1.7** Kiểm tra: "Success. No rows returned"
- [ ] **1.8** Vào **Table Editor** → Kiểm tra bảng `test_violation_logs` đã có

---

## 🧪 Bước 2: Testing

- [ ] **2.1** Mở trang làm bài test
- [ ] **2.2** Nhập mã access code
- [ ] **2.3** Nhập tên thí sinh
- [ ] **2.4** Click "Bắt đầu làm bài"
- [ ] **2.5** Chờ enter fullscreen
- [ ] **2.6** **Test vi phạm 1**: Chuyển tab (Alt+Tab / Cmd+Tab)
  - [ ] Thấy modal cảnh báo "⚠️ Cảnh báo vi phạm!"
  - [ ] Thấy "Rời khỏi tab làm bài"
  - [ ] Thấy "Vi phạm: 1 lần"
- [ ] **2.7** Click "ĐÃ HIỂU"
- [ ] **2.8** **Test vi phạm 2**: Thoát fullscreen (ESC)
  - [ ] Thấy modal cảnh báo
  - [ ] Thấy "Thoát chế độ toàn màn hình"
  - [ ] Thấy "Vi phạm: 2 lần"
- [ ] **2.9** Click "ĐÃ HIỂU"
- [ ] **2.10** Nộp bài

---

## 🔍 Bước 3: Verify Database

- [ ] **3.1** Mở Supabase Dashboard
- [ ] **3.2** Vào **Table Editor**
- [ ] **3.3** Chọn bảng `test_violation_logs`
- [ ] **3.4** Kiểm tra có **2 records** mới
- [ ] **3.5** Kiểm tra record 1:
  - [ ] `violation_reason`: "Rời khỏi tab làm bài"
  - [ ] `violated_at`: Có timestamp đúng
- [ ] **3.6** Kiểm tra record 2:
  - [ ] `violation_reason`: "Thoát chế độ toàn màn hình"
  - [ ] `violated_at`: Có timestamp đúng
- [ ] **3.7** Kiểm tra `access_code_id` khớp với code vừa dùng

---

## 📊 Bước 4: Verify UI (Reports)

- [ ] **4.1** Vào trang `/reports`
- [ ] **4.2** Tìm submission vừa nộp
- [ ] **4.3** Click vào submission đó
- [ ] **4.4** Scroll xuống → Thấy section "⚠️ Lịch sử Vi phạm (2)"
- [ ] **4.5** Kiểm tra vi phạm #1:
  - [ ] Lý do: "Rời khỏi tab làm bài"
  - [ ] Thời gian: Hiển thị format dd/mm/yyyy hh:mm:ss
- [ ] **4.6** Kiểm tra vi phạm #2:
  - [ ] Lý do: "Thoát chế độ toàn màn hình"
  - [ ] Thời gian: Hiển thị đúng
- [ ] **4.7** Kiểm tra thứ tự: Vi phạm #1 xảy ra trước #2

---

## 🔧 Bước 5: Advanced Testing (Tùy chọn)

- [ ] **5.1** Test với `max_violations`:
  - [ ] Vào Supabase → Table `tests`
  - [ ] Set `max_violations = 3` cho một test
  - [ ] Làm bài → Vi phạm 3 lần
  - [ ] Kiểm tra: Bài làm bị khóa sau lần 3
- [ ] **5.2** Test violation log với nhiều thí sinh:
  - [ ] Tạo 3 access codes
  - [ ] 3 người làm bài, mỗi người vi phạm khác nhau
  - [ ] Kiểm tra logs trong database: Mỗi người có logs riêng
- [ ] **5.3** Test query SQL:
  - [ ] Mở SQL Editor
  - [ ] Chạy một query từ file `QUERY_VIOLATION_LOGS.sql`
  - [ ] Kiểm tra kết quả có ý nghĩa

---

## 📈 Bước 6: Production Checklist

- [ ] **6.1** Code đã commit và push lên Git
- [ ] **6.2** Migration SQL đã chạy trên production database
- [ ] **6.3** Test trên production environment
- [ ] **6.4** Backup database trước khi deploy (recommended)
- [ ] **6.5** Monitor logs sau deploy 1-2 ngày
- [ ] **6.6** Kiểm tra performance: Query violation logs không làm chậm app
- [ ] **6.7** (Optional) Setup cron job để cleanup logs cũ (> 90 ngày)

---

## 📝 Bước 7: Documentation

- [ ] **7.1** Đọc file `SUMMARY_VIOLATION_TRACKING.md`
- [ ] **7.2** Đọc file `BEFORE_AFTER_COMPARISON.md`
- [ ] **7.3** Lưu file `QUERY_VIOLATION_LOGS.sql` để dùng sau này
- [ ] **7.4** Chia sẻ `QUICK_START_VIOLATION_TRACKING.md` cho team
- [ ] **7.5** Ghi chú lại `access_code_id` của các test case để demo

---

## ✅ Final Check

- [ ] ✨ Database có bảng `test_violation_logs`
- [ ] ✨ Vi phạm được ghi log với timestamp chính xác
- [ ] ✨ UI hiển thị lịch sử vi phạm đầy đủ
- [ ] ✨ Có thể query và phân tích logs
- [ ] ✨ Code clean, không có lỗi console
- [ ] ✨ Performance tốt (không lag)

---

## 🎉 Hoàn thành!

Nếu tất cả các checkbox trên đã được tick ✅, bạn đã triển khai thành công tính năng **Violation Tracking with Timestamp**!

---

## 🆘 Troubleshooting

### Issue 1: Không thấy bảng `test_violation_logs`
- ✅ Kiểm tra lại: SQL migration đã chạy thành công chưa?
- ✅ Refresh Table Editor
- ✅ Chạy lại file `ADD_VIOLATION_LOGS.sql`

### Issue 2: Vi phạm không được ghi log
- ✅ Mở Console (F12) → Xem có error không
- ✅ Kiểm tra RLS policies của bảng `test_violation_logs`
- ✅ Chạy lại policy SQL trong `ADD_VIOLATION_LOGS.sql`

### Issue 3: UI không hiển thị logs
- ✅ Kiểm tra: `violationLogs` state có data không (React DevTools)
- ✅ Kiểm tra: Query Supabase có lỗi không (Console)
- ✅ Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Issue 4: Timestamp sai múi giờ
- ✅ Kiểm tra column type: Phải là `TIMESTAMPTZ`
- ✅ Sử dụng `new Date().toISOString()` khi insert

---

**Tip**: Save checklist này để dùng cho lần sau khi deploy tính năng mới! 📌
