import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-900">
            <h2 className="text-3xl font-bold mb-4 text-[var(--primary)]">404 - Not Found</h2>
            <p className="mb-6 text-lg">Không tìm thấy trang bạn yêu cầu.</p>
            <Link
                href="/"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
                Trở về trang chủ
            </Link>
        </div>
    )
}
