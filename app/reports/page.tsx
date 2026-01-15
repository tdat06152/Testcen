'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'


type SubmissionRow = {
  id: string
  test_id: string
  candidate_name: string | null // ✅ thêm
  score_percent: number
  correct_count: number
  total_count: number
  passed: boolean
  duration_seconds: number | null
  created_at: string
}

type TestRow = {
  id: string
  title: string
}

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds === undefined) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default function ReportsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [subs, setSubs] = useState<SubmissionRow[]>([])
  const [testsMap, setTestsMap] = useState<Record<string, TestRow>>({})

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)

      // 1) load submissions (newest first) ✅ lấy thêm candidate_name
      const { data: s, error: sErr } = await supabase
        .from('test_submissions')
        .select('id,test_id,candidate_name,score_percent,correct_count,total_count,passed,duration_seconds,created_at')
        .order('created_at', { ascending: false })

      if (sErr) {
        setError(sErr.message)
        setLoading(false)
        return
      }

      const rows = (s ?? []) as SubmissionRow[]
      setSubs(rows)

      // 2) load tests titles for displayed rows
      const testIds = Array.from(new Set(rows.map(r => r.test_id))).filter(Boolean)
      if (testIds.length > 0) {
        const { data: t, error: tErr } = await supabase.from('tests').select('id,title').in('id', testIds)

        if (tErr) {
          setError(tErr.message)
          setLoading(false)
          return
        }

        const map: Record<string, TestRow> = {}
        for (const item of (t ?? []) as TestRow[]) map[item.id] = item
        setTestsMap(map)
      } else {
        setTestsMap({})
      }

      setLoading(false)
    }

    run()
  }, [])

  const rows = useMemo(() => {
    return subs.map(s => ({
      ...s,
      test_title: testsMap[s.test_id]?.title ?? s.test_id,
    }))
  }, [subs, testsMap])

  if (loading) return <div className="p-6 text-gray-600">Đang tải...</div>
  if (error) return <div className="p-6 text-red-600">Lỗi: {error}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--primary)]">Báo cáo</h1>
        <p className="mt-1 text-sm text-gray-500">Danh sách các bài làm đã nộp.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200 text-gray-700">
                <th className="p-4 text-left font-semibold">Bài test</th>
                <th className="p-4 text-left font-semibold">Thí sinh</th> {/* ✅ thêm */}
                <th className="p-4 text-center font-semibold whitespace-nowrap">Điểm</th>
                <th className="p-4 text-center font-semibold whitespace-nowrap">Kết quả</th>
                <th className="p-4 text-center font-semibold whitespace-nowrap">Thời gian</th>
                <th className="p-4 text-center font-semibold whitespace-nowrap">Chi tiết</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="p-4">
                    <div className="font-semibold text-gray-900">{(r as any).test_title}</div>
                    <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
                  </td>

                  {/* ✅ tên người làm */}
                  <td className="p-4">
                    <div className="font-medium text-gray-900">
                      {r.candidate_name?.trim() || '—'}
                    </div>
                  </td>

                  <td className="p-4 text-center text-gray-900 whitespace-nowrap">
                    <span className="font-semibold">{r.score_percent}%</span>{' '}
                    <span className="text-gray-500">
                      ({r.correct_count}/{r.total_count})
                    </span>
                  </td>

                  <td className="p-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs border ${
                        r.passed
                          ? 'border-green-300 bg-green-50 text-green-700'
                          : 'border-red-300 bg-red-50 text-red-700'
                      }`}
                    >
                      {r.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                    </span>
                  </td>

                  <td className="p-4 text-center text-gray-700 whitespace-nowrap">
                    {formatDuration(r.duration_seconds)}
                  </td>

                  <td className="p-4 text-center whitespace-nowrap">
                    <Link
                      href={`/reports/${r.id}`}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-[var(--secondary)] text-white hover:opacity-90"
                    >
                      Xem
                    </Link>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Chưa có submission nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
