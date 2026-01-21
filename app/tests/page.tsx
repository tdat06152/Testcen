'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import * as XLSX from 'xlsx'

function randomCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export default function ManageTests() {
  const supabase = createClient()
  const [tests, setTests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [issued, setIssued] = useState<Record<string, string[]>>({}) // testId -> codes vừa cấp

  // Export State
  const [exportModal, setExportModal] = useState<{ id: string; title: string } | null>(null)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const fetchTests = async () => {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) alert(error.message)
      setTests(data || [])
      setLoading(false)
    }

    fetchTests()
  }, [])

  const reloadOne = async (id: string) => {
    const { data, error } = await supabase.from('tests').select('*').eq('id', id).single()
    if (!error && data) {
      setTests(prev => prev.map(t => (t.id === id ? data : t)))
    }
  }

  const togglePublish = async (test: any) => {
    setBusyId(test.id)
    setIssued(prev => ({ ...prev, [test.id]: [] }))

    const nextStatus = test.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('tests').update({ status: nextStatus }).eq('id', test.id)
    if (error) alert(error.message)

    await reloadOne(test.id)
    setBusyId(null)
  }

  const issueCodes = async (test: any) => {
    if (test.status !== 'published') {
      alert('Phải xuất bản trước khi cấp mã.')
      return
    }

    setBusyId(test.id)

    const codes = [randomCode(8), randomCode(8), randomCode(8)]
    const payload = codes.map(code => ({
      test_id: test.id,
      code,
      is_used: false,
    }))

    const { error } = await supabase.from('test_access_codes').insert(payload)
    if (error) {
      alert(error.message)
      setBusyId(null)
      return
    }

    setIssued(prev => ({ ...prev, [test.id]: codes }))
    setBusyId(null)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('✅ Đã copy')
    } catch { }
  }

  const handleExport = async (type: 'csv' | 'excel' | 'google') => {
    if (!exportModal) return
    setExporting(true)

    try {
      let query = supabase
        .from('test_submissions')
        .select('*')
        .eq('test_id', exportModal.id)
        .order('created_at', { ascending: false })

      if (dateRange.from) query = query.gte('created_at', new Date(dateRange.from).toISOString())
      if (dateRange.to) query = query.lte('created_at', new Date(dateRange.to).toISOString())

      const { data, error } = await query

      if (error) throw error
      if (!data || data.length === 0) {
        alert('Không có dữ liệu trong khoảng thời gian này')
        setExporting(false)
        return
      }

      // Map data
      const rows = data.map((s: any) => ({
        'ID': s.id,
        'Họ tên': s.candidate_name,
        'Điểm số': s.score_percent,
        'Số câu đúng': s.correct_count,
        'Tổng câu': s.total_count,
        'Kết quả': s.passed ? 'ĐẠT' : 'KHÔNG ĐẠT',
        'Thời gian làm bài (giây)': s.duration_seconds,
        'Số lần vi phạm': s.violation_count,
        'Ngày nộp': new Date(s.created_at).toLocaleString('vi-VN'),
      }))

      const workSheet = XLSX.utils.json_to_sheet(rows)
      const workBook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workBook, workSheet, "Submissions")

      if (type === 'google') {
        const csv = XLSX.utils.sheet_to_csv(workSheet, { FS: '\t' })
        await navigator.clipboard.writeText(csv)
        alert('✅ Đã copy dữ liệu! Bạn có thể paste trực tiếp vào Google Sheets.')
      } else if (type === 'csv') {
        XLSX.writeFile(workBook, `Report_${exportModal.title}_${Date.now()}.csv`)
      } else {
        XLSX.writeFile(workBook, `Report_${exportModal.title}_${Date.now()}.xlsx`)
      }

    } catch (err: any) {
      alert('Lỗi xuất dữ liệu: ' + err.message)
    } finally {
      setExporting(false)
    }
  }
  if (loading) return <div className="text-white">Đang tải...</div>

  return (
    <div className="space-y-6 p-6 bg-white/10 rounded-xl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-orange-400">Quản lý bài test</h1>

        <Link href="/tests/manage/create" className="px-6 py-3 bg-orange-500 text-white rounded-xl">
          + Tạo mới
        </Link>
      </div>

      <table className="w-full text-white">
        <thead>
          <tr className="border-b border-white/20">
            <th className="p-3 text-left">Tiêu đề</th>
            <th className="p-3">Thời gian</th>
            <th className="p-3">Điểm đậu</th>
            <th className="p-3">Trạng thái</th>
            <th className="p-3">Hành động</th>
          </tr>
        </thead>

        <tbody>
          {tests.map(test => {
            const isBusy = busyId === test.id
            const justIssued = issued[test.id] || []
            const playPath = `/tests/${test.id}`

            return (
              // ✅ CHỈ 1 TR / 1 TEST => HẾT LỖI KEY
              <tr key={test.id} className="border-b border-white/10 align-top">
                {/* TIÊU ĐỀ + LINK + MÃ */}
                <td className="p-3">
                  <div className="font-semibold">{test.title}</div>

                  {/* ✅ Link chỉ hiện khi published */}
                  {test.status === 'published' ? (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <a
                        className="underline text-orange-200"
                        href={playPath}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Link làm bài
                      </a>
                      <button
                        onClick={() => copy(`${window.location.origin}${playPath}`)}
                        className="px-2 py-1 bg-white/10 rounded"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-300">
                      (Chưa xuất bản → link làm bài bị khóa)
                    </div>
                  )}

                  {justIssued.length > 0 && (
                    <div className="mt-3 bg-white/10 rounded-lg p-3">
                      <div className="font-semibold text-orange-200">
                        3 mã vừa cấp (dùng 1 lần)
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {justIssued.map(code => (
                          <span key={code} className="font-mono px-3 py-1 rounded bg-white/10">
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </td>

                {/* THỜI GIAN */}
                <td className="p-3 text-center">
                  {test.duration_minutes ? `${test.duration_minutes} phút` : 'Không giới hạn'}
                </td>

                {/* ĐIỂM */}
                <td className="p-3 text-center">{test.pass_score}%</td>

                {/* TRẠNG THÁI */}
                <td className="p-3 text-center">
                  {test.status === 'published' ? 'Xuất bản' : 'Nháp'}
                </td>

                {/* ACTIONS */}
                <td className="p-3">
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Link href={`/tests/manage/${test.id}/questions`} className="px-2 py-1 bg-blue-500/20 rounded">
                      Câu hỏi
                    </Link>

                    <Link href={`/tests/manage/${test.id}/edit`} className="px-2 py-1 bg-orange-500/20 rounded">
                      Sửa
                    </Link>

                    <button
                      onClick={() => togglePublish(test)}
                      disabled={isBusy}
                      className="px-2 py-1 bg-green-500/20 rounded disabled:opacity-50"
                    >
                      {isBusy ? 'Đang...' : test.status === 'published' ? 'Ngưng' : 'Xuất bản'}
                    </button>

                    <button
                      onClick={() => issueCodes(test)}
                      disabled={isBusy || test.status !== 'published'}
                      className="px-2 py-1 bg-purple-500/20 rounded disabled:opacity-50"
                      title={test.status !== 'published' ? 'Xuất bản trước khi cấp mã' : ''}
                    >
                      {isBusy ? 'Đang...' : 'Cấp mã'}
                    </button>

                    <button
                      onClick={async () => {
                        if (!confirm('Xoá bài test?')) return
                        await supabase.from('tests').delete().eq('id', test.id)
                        setTests(prev => prev.filter(t => t.id !== test.id))
                      }}
                      className="px-2 py-1 bg-red-500/20 rounded"
                    >
                      Xoá
                    </button>

                    <button
                      onClick={() => {
                        const now = new Date()
                        now.setMinutes(now.getMinutes() - now.getTimezoneOffset()) // adjust for local input
                        const start = new Date()
                        start.setDate(start.getDate() - 30)
                        start.setMinutes(start.getMinutes() - start.getTimezoneOffset())

                        setExportModal({ id: test.id, title: test.title })
                        setDateRange({
                          from: start.toISOString().slice(0, 16),
                          to: now.toISOString().slice(0, 16)
                        })
                      }}
                      className="px-2 py-1 bg-teal-500/20 rounded"
                    >
                      Xuất DL
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </table>

      {/* EXPORT MODAL */ }
  {
    exportModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white text-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">Xuất dữ liệu</h3>
            <button
              onClick={() => setExportModal(null)}
              className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mb-4">
              Đang xuất dữ liệu cho bài: <span className="font-bold">{exportModal.title}</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Từ ngày</label>
                <input
                  type="datetime-local"
                  value={dateRange.from}
                  onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Đến ngày</label>
                <input
                  type="datetime-local"
                  value={dateRange.to}
                  onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-2 grid grid-cols-1 gap-3">
              <button
                onClick={() => handleExport('google')}
                disabled={exporting}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2 group"
              >
                {exporting ? 'Đang xử lý...' : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2.033 16.01c.564-1.789 1.632-3.932 1.821-4.474.273-.787-.211-1.136-1.74.209l-.34-.64c1.744-1.897 5.335-2.326 4.113.613-.763 1.835-1.309 3.074-1.635 4.034-.496 1.477.385 1.125 1.834.206l.34.64c-1.668 1.815-5.462 2.656-4.393.57z" /></svg>
                    Google Sheets (Copy)
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleExport('excel')}
                  disabled={exporting}
                  className="py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Excel (.xlsx)
                </button>

                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className="py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  CSV
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => setExportModal(null)}
              className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    )
  }
    </div >
  )
}
