# Tính năng Giới hạn Vi phạm (Max Violations)

## Tổng quan

Đã implement chức năng cho phép thiết lập số lần vi phạm tối đa cho mỗi bài test. Khi user vượt quá số lần vi phạm, bài làm sẽ bị khóa và buộc phải nộp bài ngay.

## Các thay đổi đã thực hiện

### 1. Database Schema
- **File**: `ADD_MAX_VIOLATIONS.sql`
- **Thay đổi**: Thêm cột `max_violations` (INTEGER, default 0) vào bảng `tests`
- **Ý nghĩa**: 
  - `0` = không giới hạn vi phạm
  - `> 0` = số lần vi phạm tối đa cho phép

### 2. Trang Quản lý Test (`/app/tests/manage/[id]/page.tsx`)
- Thêm field "Số lần vi phạm tối đa" trong phần **Thông tin cơ bản**
- Vị trí: Ngay sau field "Điểm đạt (%)"
- Có mô tả rõ ràng về các loại vi phạm
- Field bị disable khi test đang xuất bản

### 3. Trang Làm bài (`/app/tests/[id]/page.tsx`)

#### a. Logic Anti-cheat đã cập nhật:
- **Khi vi phạm**: 
  - Tăng counter vi phạm
  - Hiện modal cảnh báo
  - **KHÔNG** tự động bật lại fullscreen (theo yêu cầu)
  - Kiểm tra xem đã vượt quá giới hạn chưa

#### b. Modal cảnh báo thông minh:
- **Khi chưa vượt quá**:
  - Icon: ⚠️
  - Màu: Đỏ
  - Hiển thị số lần vi phạm hiện tại / tối đa
  - Hiển thị số lần còn lại
  - Nút: "ĐÃ HIỂU" (chỉ đóng modal, không bật fullscreen)

- **Khi vượt quá giới hạn**:
  - Icon: 🔒
  - Màu: Đen
  - Thông báo bài làm đã bị khóa
  - Nút: "NỘP BÀI NGAY" (tự động submit)

## Các loại vi phạm được phát hiện

1. **Tab switching**: Chuyển sang tab khác
2. **Window blur**: Click ra ngoài window
3. **Exit fullscreen**: Thoát chế độ toàn màn hình
4. **Screenshot**: Phát hiện phím PrintScreen (limited browser support)

## Cách test

### Bước 1: Chạy Migration
```bash
# Làm theo hướng dẫn trong MIGRATION_MAX_VIOLATIONS.md
# Hoặc chạy file ADD_MAX_VIOLATIONS.sql trong Supabase SQL Editor
```

### Bước 2: Khởi động app
```bash
npm run dev
```

### Bước 3: Tạo/Sửa test
1. Vào trang quản lý test
2. Trong tab "Thông tin cơ bản"
3. Tìm field "Số lần vi phạm tối đa"
4. Nhập số (ví dụ: 3)
5. Lưu thay đổi
6. Xuất bản test

### Bước 4: Test chức năng
1. Mở test với access code
2. Nhập tên và bắt đầu làm bài
3. Thử vi phạm (ví dụ: nhấn Cmd+Tab để chuyển app)
4. **Kiểm tra**:
   - Modal cảnh báo xuất hiện
   - Hiển thị số lần vi phạm
   - Nhấn "ĐÃ HIỂU" để đóng modal
   - **Fullscreen KHÔNG tự động bật lại** ✅
5. Vi phạm thêm lần nữa cho đến khi vượt quá giới hạn
6. **Kiểm tra khi vượt quá**:
   - Modal đổi màu đen với icon 🔒
   - Thông báo bài làm bị khóa
   - Chỉ có nút "NỘP BÀI NGAY"
   - Nhấn nút sẽ tự động submit bài

### Bước 5: Kiểm tra kết quả
1. Sau khi nộp bài, kiểm tra trong Supabase
2. Bảng `test_submissions` sẽ có cột `violation_count`
3. Giá trị phải khớp với số lần vi phạm thực tế

## Lưu ý quan trọng

### ✅ Đã implement đúng yêu cầu:
- Khi tab màn hình → Chỉ hiện cảnh báo, ghi nhận vi phạm
- **KHÔNG** tự động bật lại fullscreen
- User phải tự bật lại fullscreen nếu muốn
- Tiếp tục count vi phạm cho đến khi vượt quá

### 🔒 Khi vượt quá giới hạn:
- Bài làm bị khóa hoàn toàn
- Không thể tiếp tục làm bài
- Buộc phải nộp bài ngay lập tức
- Số lần vi phạm được lưu vào database

### 🎯 Trường hợp đặc biệt:
- `max_violations = 0`: Không giới hạn, chỉ cảnh báo và ghi nhận
- `max_violations > 0`: Áp dụng giới hạn nghiêm ngặt

## Files đã thay đổi

1. ✅ `ADD_MAX_VIOLATIONS.sql` - Migration SQL
2. ✅ `MIGRATION_MAX_VIOLATIONS.md` - Hướng dẫn migration
3. ✅ `app/tests/manage/[id]/page.tsx` - UI quản lý test
4. ✅ `app/tests/[id]/page.tsx` - Logic anti-cheat và modal
5. ✅ `FEATURE_MAX_VIOLATIONS.md` - File này (documentation)

## Troubleshooting

### Lỗi: "max_violations is not defined"
→ Chưa chạy migration. Xem `MIGRATION_MAX_VIOLATIONS.md`

### Modal không hiện
→ Kiểm tra console log, có thể browser block fullscreen API

### Vi phạm không được count
→ Kiểm tra `test.max_violations` có được load đúng không

### Fullscreen tự động bật lại
→ Đã fix, không còn tự động bật lại nữa

---

**Hoàn thành**: Tất cả yêu cầu đã được implement đúng theo specification.
