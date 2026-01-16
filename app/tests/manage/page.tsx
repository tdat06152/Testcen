'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

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
  const [issued, setIssued] = useState<Record<string, string[]>>({}) // testId -> 3 codes vừa cấp

  useEffect(() => {
    const fetchTests = async () => {
      const { data, error } = await supabase.from('tests').select('*')
      if (error) alert(error.message)
      setTests(data || [])
      setLoading(false)
    }

    fetchTests()
  }, [])

  const reloadOne = async (id: string) => {
    const { data, error } = await supabase.from('tests').select('*').eq('id', id).single()
    if (error) return
    setTests(prev => prev.map(t => (t.id === id ? data : t)))
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

  if (loading) return <div className="text-gray-600">Đang tải...</div>

  return (
    <div className="space-y-6 p-6 bg-white rounded-xl border border-gray-200">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-[var(--primary)]">Quản lý bài test</h1>

        <Link href="/tests/manage/create" className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl hover:opacity-90">
          + Tạo mới
        </Link>
      </div>

      <table className="w-full text-gray-900">
        <thead>
          <tr className="border-b border-gray-200 text-gray-700">
            <th className="p-3 text-left">Tiêu đề</th>
            <th className="p-3">Thời gian</th>
            <th className="p-3">Điểm đậu</th>
            <th className="p-3">Trạng thái</th>
            <th className="p-3">Hành động</th>
          </tr>
        </thead>

        <tbody>
          {tests.map(test => {
            const playPath = `/tests/${test.id}`
            const justIssued = issued[test.id] || []
            const isBusy = busyId === test.id

            return (
              <tr key={test.id} className="border-b border-gray-100 align-top">
                <td className="p-3">
                  <div className="font-semibold">{test.title}</div>

                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <a className="underline text-[var(--secondary)]" href={playPath} target="_blank" rel="noreferrer">
                      Link làm bài
                    </a>
                    <button
                      onClick={() => copy(`${window.location.origin}${playPath}`)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                    >
                      Copy
                    </button>
                  </div>

                  {justIssued.length > 0 && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="font-semibold text-[var(--primary)]">3 mã vừa cấp (dùng 1 lần)</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {justIssued.map((c: string) => (
                          <span key={c} className="font-mono px-3 py-1 rounded bg-white border border-gray-200 text-gray-800">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </td>

                <td className="p-3 text-center">
                  {test.duration_minutes ? `${test.duration_minutes} phút` : 'Không giới hạn'}
                </td>

                <td className="p-3 text-center">{test.pass_score}%</td>

                <td className="p-3 text-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-700">
                    {test.status === 'published' ? 'Xuất bản' : 'Nháp'}
                  </span>
                </td>

                {/* ✅ ACTIONS: cam/xanh/xám/đỏ */}
                <td className="p-3">
                  <div className="flex gap-2 justify-center flex-wrap">
                    {/* Câu hỏi — xanh */}
                    <Link
                      href={`/tests/manage/${test.id}?tab=questions`}
                      className="px-3 py-1.5 rounded-md bg-[var(--secondary)] text-white hover:opacity-90"
                    >
                      Câu hỏi
                    </Link>

                    {/* Sửa — cam */}
                    <Link
                      href={`/tests/manage/${test.id}?tab=info`}
                      className="px-3 py-1.5 rounded-md bg-[var(--primary)] text-white hover:opacity-90"
                    >
                      Sửa
                    </Link>

                    {/* Xuất bản / Ngưng — xám */}
                    <button
                      onClick={() => togglePublish(test)}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                    >
                      {isBusy ? 'Đang...' : test.status === 'published' ? 'Ngưng' : 'Xuất bản'}
                    </button>

                    {/* Cấp mã (3) — xanh */}
                    <button
                      onClick={() => issueCodes(test)}
                      disabled={isBusy || test.status !== 'published'}
                      className="px-3 py-1.5 rounded-md bg-[var(--secondary)] text-white hover:opacity-90 disabled:opacity-50"
                      title={test.status !== 'published' ? 'Xuất bản trước khi cấp mã' : ''}
                    >
                      {isBusy ? 'Đang...' : 'Cấp mã (3)'}
                    </button>

                    {/* Xoá — đỏ */}
                    <button
                      onClick={async () => {
                        if (!confirm('Xoá bài test?')) return
                        await supabase.from('tests').delete().eq('id', test.id)
                        setTests(prev => prev.filter(t => t.id !== test.id))
                      }}
                      className="px-3 py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600"
                    >
                      Xoá
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
