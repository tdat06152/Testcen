# 📚 INDEX: Tài liệu Violation Tracking

## 🎯 Quick Start

**Bắt đầu từ đây:**
📖 **[QUICK_START_VIOLATION_TRACKING.md](./QUICK_START_VIOLATION_TRACKING.md)** - Hướng dẫn nhanh 3 phút

---

## 📂 Danh sách Files

### 1️⃣ Migration & Setup

| File | Mô tả | Độ ưu tiên |
|------|-------|------------|
| **[ADD_VIOLATION_LOGS.sql](./ADD_VIOLATION_LOGS.sql)** | ⚡ Migration SQL - CHẠY FILE NÀY TRƯỚC | 🔴 CAO NHẤT |
| **[CHECKLIST_VIOLATION_TRACKING.md](./CHECKLIST_VIOLATION_TRACKING.md)** | ✅ Checklist từng bước triển khai | 🟡 Trung bình |
| **[MIGRATION_VIOLATION_LOGS.md](./MIGRATION_VIOLATION_LOGS.md)** | 📋 Chi tiết về migration | 🟢 Tham khảo |

### 2️⃣ Documentation

| File | Mô tả | Độ ưu tiên |
|------|-------|------------|
| **[SUMMARY_VIOLATION_TRACKING.md](./SUMMARY_VIOLATION_TRACKING.md)** | 📘 Tài liệu đầy đủ, chi tiết | 🔴 CAO |
| **[BEFORE_AFTER_COMPARISON.md](./BEFORE_AFTER_COMPARISON.md)** | 📊 So sánh trước/sau để hiểu lợi ích | 🟡 Trung bình |
| **[QUICK_START_VIOLATION_TRACKING.md](./QUICK_START_VIOLATION_TRACKING.md)** | ⚡ Bắt đầu nhanh | 🔴 CAO |

### 3️⃣ Query & Analysis

| File | Mô tả | Độ ưu tiên |
|------|-------|------------|
| **[QUERY_VIOLATION_LOGS.sql](./QUERY_VIOLATION_LOGS.sql)** | 🔍 12+ query mẫu để phân tích | 🟡 Trung bình |

### 4️⃣ Source Code

| File | Mô tả | Thay đổi |
|------|-------|----------|
| **[app/tests/[id]/page.tsx](./app/tests/[id]/page.tsx)** | 💻 Ghi log vi phạm | `handleViolation` → async |
| **[app/reports/[id]/page.tsx](./app/reports/[id]/page.tsx)** | 📊 Hiển thị lịch sử vi phạm | Thêm UI section mới |

---

## 🚀 Workflow Khuyến nghị

### Lần đầu triển khai:
1. 📖 Đọc **QUICK_START_VIOLATION_TRACKING.md** (3 phút)
2. ⚡ Chạy **ADD_VIOLATION_LOGS.sql** trong Supabase
3. ✅ Làm theo **CHECKLIST_VIOLATION_TRACKING.md**
4. 🧪 Test chức năng
5. 📊 Xem report có section vi phạm

### Khi cần hiểu sâu:
1. 📘 Đọc **SUMMARY_VIOLATION_TRACKING.md**
2. 📊 Đọc **BEFORE_AFTER_COMPARISON.md**

### Khi cần phân tích/query:
1. 🔍 Mở **QUERY_VIOLATION_LOGS.sql**
2. Copy query cần thiết
3. Chạy trong Supabase SQL Editor

---

## 🎓 Use Cases

### 👨‍🎓 Tôi là giáo viên/Admin
**Bạn cần:**
1. ✅ [CHECKLIST_VIOLATION_TRACKING.md](./CHECKLIST_VIOLATION_TRACKING.md) - Để setup
2. 📊 [BEFORE_AFTER_COMPARISON.md](./BEFORE_AFTER_COMPARISON.md) - Để hiểu lợi ích
3. 🔍 [QUERY_VIOLATION_LOGS.sql](./QUERY_VIOLATION_LOGS.sql) - Để xem báo cáo

### 👨‍💻 Tôi là developer
**Bạn cần:**
1. 📘 [SUMMARY_VIOLATION_TRACKING.md](./SUMMARY_VIOLATION_TRACKING.md) - Technical details
2. ⚡ [ADD_VIOLATION_LOGS.sql](./ADD_VIOLATION_LOGS.sql) - Schema
3. Source code: `app/tests/[id]/page.tsx` và `app/reports/[id]/page.tsx`

### 📊 Tôi cần làm báo cáo
**Bạn cần:**
1. 🔍 [QUERY_VIOLATION_LOGS.sql](./QUERY_VIOLATION_LOGS.sql) - Queries sẵn
2. 📊 [BEFORE_AFTER_COMPARISON.md](./BEFORE_AFTER_COMPARISON.md) - Ví dụ báo cáo

### ⏰ Tôi chỉ có 5 phút
**Bạn cần:**
1. ⚡ [QUICK_START_VIOLATION_TRACKING.md](./QUICK_START_VIOLATION_TRACKING.md)

---

## 📊 Database Schema

```sql
test_violation_logs
├── id                UUID (PK)
├── test_id           UUID → tests.id
├── access_code_id    UUID → test_access_codes.id
├── submission_id     UUID → test_submissions.id (nullable)
├── violation_reason  TEXT
├── violated_at       TIMESTAMPTZ  ← ⏰ TIMESTAMP
└── created_at        TIMESTAMPTZ
```

---

## 🔗 Related Features

- **Violation Counter**: `test_submissions.violation_count`
- **Max Violations**: `tests.max_violations` (limit vi phạm)
- **Auto Lock**: Tự động khóa bài khi vượt quá max_violations

---

## ✅ Quick Reference

### Chạy migration:
```bash
# Supabase Dashboard → SQL Editor → Paste ADD_VIOLATION_LOGS.sql → Run
```

### Xem logs trong DB:
```sql
SELECT * FROM test_violation_logs 
ORDER BY violated_at DESC 
LIMIT 10;
```

### Xem logs trong UI:
```
/reports/{submission_id} → Scroll xuống → Section "⚠️ Lịch sử Vi phạm"
```

---

## 🆘 Support

**Có vấn đề?**
1. Xem mục **Troubleshooting** trong [CHECKLIST_VIOLATION_TRACKING.md](./CHECKLIST_VIOLATION_TRACKING.md)
2. Đọc [SUMMARY_VIOLATION_TRACKING.md](./SUMMARY_VIOLATION_TRACKING.md) phần "TODO"
3. Kiểm tra Console (F12) để xem error

---

## 📌 Tóm tắt 1 dòng

> **Tracking chi tiết từng vi phạm với timestamp chính xác - Từ "biết có vi phạm" thành "biết ai, làm gì, lúc nào"** 🎯

---

**Last Updated**: 2026-02-03  
**Version**: 1.0  
**Status**: ✅ Production Ready
