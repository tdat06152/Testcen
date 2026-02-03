# ✅ Cập nhật: Tracking Chi Tiết Vi Phạm với Timestamp

## 📋 Tổng quan
Hệ thống hiện tại đã được cập nhật để **ghi lại từng lần vi phạm** với **thời gian chính xác** khi sự kiện xảy ra.

---

## 🔧 Các thay đổi đã thực hiện

### 1. **Database**
#### File: `ADD_VIOLATION_LOGS.sql`
- **Tạo bảng mới**: `test_violation_logs`
- **Cột chính**:
  - `id`: UUID primary key
  - `test_id`: ID bài test
  - `access_code_id`: ID access code
  - `submission_id`: ID submission (nullable - vì có thể chưa nộp bài)
  - `violation_reason`: Lý do vi phạm (TEXT)
  - `violated_at`: **⏰ Timestamp chính xác khi vi phạm xảy ra**
  - `created_at`: Timestamp tạo record

- **Index**: Đã tạo index cho query nhanh
- **RLS**: Đã enable Row Level Security

#### Cách chạy migration:
```sql
-- Mở Supabase Dashboard → SQL Editor
-- Copy & paste nội dung file ADD_VIOLATION_LOGS.sql
-- Chạy SQL
```

---

### 2. **Frontend - Test Page**
#### File: `app/tests/[id]/page.tsx`

**Thay đổi chính**:
- Hàm `handleViolation` giờ là **async**
- Mỗi khi phát hiện vi phạm:
  1. Tăng counter (violationCount)
  2. Hiển thị modal cảnh báo
  3. **✅ GHI LOG vào database với timestamp**

**Code snippet**:
```tsx
const handleViolation = async (reason: string) => {
  const newCount = violationCount + 1
  setViolationCount(newCount)
  setViolationReason(reason)

  // Lưu localStorage
  if (testId && accessCodeId) {
    localStorage.setItem(`test_violations:${testId}:${accessCodeId}`, newCount.toString())
  }

  // ✅ GHI LOG VI PHẠM VÀO DATABASE với timestamp
  try {
    const { error: logError } = await supabase
      .from('test_violation_logs')
      .insert({
        test_id: testId,
        access_code_id: accessCodeId,
        violation_reason: reason,
        violated_at: new Date().toISOString(), // ⏰ TIMESTAMP
        submission_id: null
      })

    if (logError) {
      console.warn('Failed to log violation:', logError)
    }
  } catch (err) {
    console.warn('Error logging violation:', err)
  }

  // Check max violations...
}
```

**Các loại vi phạm được tracking**:
- `"Rời khỏi tab làm bài"` - Tab switch / Visibility change
- `"Mất tập trung vào màn hình làm bài (Blur)"` - Window blur
- `"Thoát chế độ toàn màn hình"` - Exit fullscreen
- `"Phát hiện chụp màn hình"` - PrintScreen

---

### 3. **Frontend - Report Page**
#### File: `app/reports/[id]/page.tsx`

**Thêm các tính năng**:
1. **Type mới**: `ViolationLog`
2. **State**: `violationLogs`
3. **Fetch logic**: Load violation logs từ database
4. **UI Section**: Hiển thị lịch sử vi phạm với timestamp

**Giao diện mới**:
```tsx
{violationLogs.length > 0 && (
  <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/30 p-5">
    <h2 className="text-lg font-bold text-red-700 mb-3">
      ⚠️ Lịch sử Vi phạm ({violationLogs.length})
    </h2>
    <div className="space-y-2">
      {violationLogs.map((log, idx) => (
        <div key={log.id} className="rounded-lg border border-red-200 bg-white p-3">
          <div className="text-sm font-semibold text-red-700">
            #{idx + 1}: {log.violation_reason}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Thời gian: {formatDateTime(log.violated_at)}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

**Helper function**:
```tsx
function formatDateTime(isoString: string | null) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
```

---

## 📊 Cách sử dụng

### 1. **Chạy Migration**
```bash
# Mở Supabase Dashboard
# SQL Editor → New Query
# Copy nội dung ADD_VIOLATION_LOGS.sql
# Run
```

### 2. **Test**
1. Vào làm bài test bất kỳ
2. Thử các hành động:
   - Chuyển tab (Alt+Tab hoặc Cmd+Tab)
   - Click ra ngoài trình duyệt
   - Thoát fullscreen (ESC)
3. Mỗi lần vi phạm sẽ được ghi vào database với timestamp

### 3. **Xem lịch sử vi phạm**
1. Vào trang **Reports** (`/reports`)
2. Click vào một submission bất kỳ
3. Nếu có vi phạm, sẽ thấy section **"⚠️ Lịch sử Vi phạm"** với:
   - Số thứ tự vi phạm
   - Lý do vi phạm
   - Thời gian chính xác (dd/mm/yyyy hh:mm:ss)

---

## 🔍 Query Database

### Xem tất cả vi phạm của một test:
```sql
SELECT 
  violation_reason,
  violated_at,
  access_code_id
FROM test_violation_logs
WHERE test_id = 'YOUR_TEST_ID'
ORDER BY violated_at DESC;
```

### Xem vi phạm của một thí sinh:
```sql
SELECT 
  violation_reason,
  violated_at
FROM test_violation_logs
WHERE access_code_id = 'YOUR_ACCESS_CODE_ID'
ORDER BY violated_at ASC;
```

### Đếm số vi phạm theo loại:
```sql
SELECT 
  violation_reason,
  COUNT(*) as count
FROM test_violation_logs
WHERE test_id = 'YOUR_TEST_ID'
GROUP BY violation_reason
ORDER BY count DESC;
```

---

## ✅ Lợi ích

1. **Ghi lại thời gian chính xác**: Biết chính xác vi phạm xảy ra lúc nào
2. **Chi tiết từng sự kiện**: Mỗi vi phạm là một record riêng
3. **Phân tích hành vi**: Có thể phân tích pattern gian lận
4. **Bằng chứng cụ thể**: Dữ liệu không thể chối cãi
5. **Báo cáo dễ dàng**: Xuất report chi tiết cho từng thí sinh

---

## 📁 Files liên quan

- `ADD_VIOLATION_LOGS.sql` - Migration SQL
- `MIGRATION_VIOLATION_LOGS.md` - Hướng dẫn migration
- `app/tests/[id]/page.tsx` - Test page (ghi log)
- `app/reports/[id]/page.tsx` - Report page (hiển thị log)
- `SUMMARY_VIOLATION_TRACKING.md` - File này

---

## 🎯 TODO (Tùy chọn)

- [ ] Export violation logs ra Excel
- [ ] Tạo dashboard thống kê vi phạm
- [ ] Chart phân tích vi phạm theo thời gian
- [ ] Email báo cáo vi phạm cho admin
- [ ] Webhook notification khi vi phạm xảy ra
