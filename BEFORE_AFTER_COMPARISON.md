# So Sánh: Trước và Sau Khi Có Violation Tracking

## ❌ TRƯỚC (Chỉ có violation_count)

### Dữ liệu lưu trữ:
```
test_submissions:
  - violation_count: 3
```

### Thông tin biết được:
- ✅ Có **3 lần** vi phạm
- ❌ **KHÔNG biết** vi phạm gì
- ❌ **KHÔNG biết** vi phạm lúc nào
- ❌ **KHÔNG có** bằng chứng cụ thể

### Báo cáo:
> "Thí sinh Nguyễn Văn A có **3 lần vi phạm**"
> 
> → Không đủ thông tin để phân tích hoặc xác minh

---

## ✅ SAU (Có violation_logs với timestamp)

### Dữ liệu lưu trữ:
```
test_submissions:
  - violation_count: 3

test_violation_logs:
  1. "Rời khỏi tab làm bài" - 14:23:15
  2. "Thoát chế độ toàn màn hình" - 14:25:42  
  3. "Rời khỏi tab làm bài" - 14:28:03
```

### Thông tin biết được:
- ✅ Có **3 lần** vi phạm
- ✅ Biết **chính xác** vi phạm gì
- ✅ Biết **thời gian** cụ thể (giờ:phút:giây)
- ✅ Có **bằng chứng** đầy đủ
- ✅ Có thể **phân tích** hành vi

### Báo cáo chi tiết:
> **Thí sinh Nguyễn Văn A có 3 lần vi phạm:**
> 
> 1. **14:23:15** - Rời khỏi tab làm bài  
> 2. **14:25:42** - Thoát chế độ toàn màn hình  
> 3. **14:28:03** - Rời khỏi tab làm bài  
>
> **Phân tích:**
> - Vi phạm lần 2 và 3 cách nhau 2 phút 21 giây
> - Có pattern: Chuyển tab 2 lần (phút 23 và 28)
> - Thoát fullscreen ở giữa (phút 25)

---

## 📊 Ví dụ trong UI

### Trước:

```
┌─────────────────────────────┐
│ Số vi phạm: 3               │
└─────────────────────────────┘
```

### Sau:

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Lịch sử Vi phạm (3)                         │
├─────────────────────────────────────────────────┤
│ #1: Rời khỏi tab làm bài                       │
│     Thời gian: 03/02/2026 14:23:15             │
├─────────────────────────────────────────────────┤
│ #2: Thoát chế độ toàn màn hình                 │
│     Thời gian: 03/02/2026 14:25:42             │
├─────────────────────────────────────────────────┤
│ #3: Rời khỏi tab làm bài                       │
│     Thời gian: 03/02/2026 14:28:03             │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Lợi ích cụ thể

| Tình huống | Trước | Sau |
|------------|-------|-----|
| **Thí sinh khiếu nại** | "Tôi không vi phạm!" → Không có proof | "Xem log: Bạn chuyển tab lúc 14:23:15" → Có proof |
| **Phân tích pattern** | Không thể | Thấy được: Vi phạm tập trung vào phút nào? |
| **Export báo cáo** | "3 lần vi phạm" | Chi tiết từng lần với timestamp |
| **Kiểm tra gian lận** | Mơ hồ | Rõ ràng, có thể verify |
| **Thống kê** | Chỉ có tổng số | Phân tích theo loại, theo thời gian |

---

## 💾 Database Schema Comparison

### Trước:
```sql
test_submissions
├── violation_count: INTEGER  -- Chỉ có số lượng
```

### Sau:
```sql
test_submissions
├── violation_count: INTEGER  -- Vẫn giữ để query nhanh

test_violation_logs  -- ✨ BẢNG MỚI
├── id: UUID
├── test_id: UUID
├── access_code_id: UUID
├── violation_reason: TEXT     -- "Rời khỏi tab làm bài"
├── violated_at: TIMESTAMPTZ   -- 2026-02-03 14:23:15+07
└── created_at: TIMESTAMPTZ
```

---

## 🔍 Use Cases

### Case 1: Thí sinh khiếu nại
**Trước:**
- Thí sinh: "Tôi không chuyển tab!"
- Admin: "Hệ thống có 3 vi phạm"
- Thí sinh: "Có thể máy lỗi"
- → **Không có cách verify**

**Sau:**
- Thí sinh: "Tôi không chuyển tab!"
- Admin: "Xem log:"
  - 14:23:15 - Rời khỏi tab
  - 14:25:42 - Thoát fullscreen
  - 14:28:03 - Rời khỏi tab
- → **Có proof rõ ràng, không thể chối**

### Case 2: Export báo cáo cho BGH
**Trước:**
```
Nguyễn Văn A - 3 vi phạm
Trần Thị B - 1 vi phạm
Lê Văn C - 0 vi phạm
```

**Sau:**
```
Nguyễn Văn A - 3 vi phạm:
  - 14:23:15: Rời khỏi tab làm bài
  - 14:25:42: Thoát chế độ toàn màn hình
  - 14:28:03: Rời khỏi tab làm bài

Trần Thị B - 1 vi phạm:
  - 14:30:22: Mất tập trung vào màn hình làm bài (Blur)

Lê Văn C - 0 vi phạm
```

### Case 3: Phân tích hành vi gian lận
**Trước:**
- Không thể phân tích

**Sau:**
- Thấy được: "Thí sinh A chuyển tab 2 lần trong vòng 5 phút → Pattern đáng ngờ"
- Thấy được: "Vi phạm xảy ra tập trung vào các câu hỏi khó"
- Có thể cross-reference với timeline làm bài

---

## 🚀 Kết luận

| Tiêu chí | Trước | Sau |
|----------|-------|-----|
| Thông tin | ⚠️ Mơ hồ | ✅ Chi tiết |
| Bằng chứng | ❌ Không có | ✅ Đầy đủ |
| Phân tích | ❌ Không thể | ✅ Được |
| Verify | ❌ Khó | ✅ Dễ |
| Báo cáo | ⚠️ Sơ sài | ✅ Chuyên nghiệp |

**→ Nâng cấp từ "Biết có vi phạm" lên "Biết chính xác ai, làm gì, lúc nào"** 🎯
