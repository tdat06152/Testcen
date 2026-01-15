# Hướng dẫn Deploy lên Vercel (Miễn phí & Dễ nhất)

Cách đơn giản và miễn phí để đưa ứng dụng Next.js + Supabase của bạn lên internet là sử dụng **Vercel** (cùng cha đẻ với Next.js) kết hợp với **GitHub**.

## Bước 1: Chuẩn bị mã nguồn (GitHub)

1.  Đăng nhập vào [GitHub](https://github.com).
2.  Tạo một Repository mới (New Repository). Đặt tên tuỳ ý (ví dụ: `test-center`).
3.  Mở Terminal tại thư mục dự án trên máy tính của bạn và chạy các lệnh sau để đẩy code lên:

```bash
# Lưu tất cả thay đổi hiện tại
git add .
git commit -m "Sẵn sàng deploy"

# Kết nối với GitHub (thay URL bằng link repo bạn vừa tạo)
git remote add origin https://github.com/USERNAME/TEN-REPO.git
git branch -M main
git push -u origin main
```

## Bước 2: Deploy lên Vercel

1.  Truy cập [Vercel](https://vercel.com) và đăng nhập bằng tài khoản **GitHub**.
2.  Bấm **"Add New..."** > **"Project"**.
3.  Vercel sẽ hiện danh sách các repo từ GitHub của bạn. Tìm repo `test-center` vừa tạo và bấm **"Import"**.

## Bước 3: Cấu hình Environment Variables (Quan trọng)

Trước khi bấm Deploy, bạn cần khai báo các biến môi trường để Vercel kết nối được với Supabase.

1.  Tìm mục **"Environment Variables"** trong trang cấu hình deploy.
2.  Thêm các biến sau (lấy giá trị từ file `.env.local` trong máy của bạn):

    *   **Name**: `NEXT_PUBLIC_SUPABASE_URL`
        *   **Value**: (Copy từ file .env.local của bạn, ví dụ: `https://xyz.supabase.co`)
    *   **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
        *   **Value**: (Copy từ file .env.local của bạn)

3.  Sau khi thêm xong, bấm nút **"Deploy"**.

## Bước 4: Hoàn tất

*   Chờ khoảng 1-2 phút để Vercel xây dựng ứng dụng.
*   Khi hoàn tất, bạn sẽ nhận được một đường link chính thức dạng `https://test-center-xyz.vercel.app`.
*   Bạn có thể gửi link này cho mọi người sử dụng!

---

## Lưu ý về Supabase

Do database của bạn đã nằm trên Supabase (Cloud) nên bạn **không cần làm gì thêm** với database. Ứng dụng trên Vercel sẽ tự động kết nối tới đó.
