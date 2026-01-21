'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'


type SubmissionRow = {
  id: string
  test_id: string
  candidate_name: string | null
  score_percent: number
  correct_count: number
  total_count: number
  passed: boolean
  duration_seconds: number | null
  violation_count: number
  created_at: string
}

type TestRow = {
  id: string
  title: string
}

type WrongQuestionStat = {
  question_id: string
  content: string
  test_title: string
  wrong_count: number
  total_attempts: number
  wrong_percent: number
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
  const [wrongStats, setWrongStats] = useState<WrongQuestionStat[]>([])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)

      // 1) load submissions (newest first)
      const { data: s, error: sErr } = await supabase
        .from('test_submissions')
        .select('id,test_id,candidate_name,score_percent,correct_count,total_count,passed,duration_seconds,violation_count,created_at')
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

      // 3) Load stats (Top wrong questions)
      {
        const { data: allAns, error: ansErr } = await supabase
          .from('test_submission_answers')
          .select('question_id, is_correct')

        if (!ansErr && allAns) {
          const statsMap = new Map<string, { total: number; wrong: number }>()
          for (const a of allAns) {
            const entry = statsMap.get(a.question_id) ?? { total: 0, wrong: 0 }
            entry.total++
            if (a.is_correct === false) entry.wrong++
            statsMap.set(a.question_id, entry)
          }

          // Sort by wrong count desc
          const sorted = Array.from(statsMap.entries())
            .sort((a, b) => b[1].wrong - a[1].wrong)
            .slice(0, 5) // Top 5

          const topQIds = sorted.map(s => s[0])

          if (topQIds.length > 0) {
            const { data: qs } = await supabase
              .from('questions')
              .select('id, content, test_id')
              .in('id', topQIds)

            const relatedTestIds = Array.from(new Set(qs?.map((q: any) => q.test_id))).filter(Boolean) as string[]

            // We might already have these tests in testsMap, but to be sure/simple, let's just fetch needed ones or reuse
            // Reuse logic: fetch missing only? for simplicity just fetch
            const { data: ts } = await supabase.from('tests').select('id, title').in('id', relatedTestIds)
            const tMap = new Map((ts ?? []).map((t: any) => [t.id, t.title]))

            const finalStats: WrongQuestionStat[] = sorted.map(([qId, stat]) => {
              const q = qs?.find((x: any) => x.id === qId)
              const testTitle = q ? (tMap.get(q.test_id) as string || 'Unknown') : 'Unknown'
              return {
                question_id: qId,
                content: q?.content ?? 'Unknown',
                test_title: String(testTitle),
                wrong_count: stat.wrong,
                total_attempts: stat.total,
                wrong_percent: stat.total > 0 ? Math.round((stat.wrong / stat.total) * 100) : 0
              }
            })
            setWrongStats(finalStats)
          } else {
            setWrongStats([])
          }
        }
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

      {/* Stats Section */}
      {wrongStats.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Câu hỏi hay sai nhất</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-red-50 text-red-900">
                <tr>
                  <th className="p-3 rounded-l-lg">Câu hỏi</th>
                  <th className="p-3">Bài test</th>
                  <th className="p-3 text-center">Số lần sai</th>
                  <th className="p-3 text-center rounded-r-lg">Tỉ lệ sai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {wrongStats.map((stat) => (
                  <tr key={stat.question_id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900 max-w-md truncate" title={stat.content}>
                      {stat.content}
                    </td>
                    <td className="p-3 text-gray-600 whitespace-nowrap">
                      {stat.test_title}
                    </td>
                    <td className="p-3 text-center font-semibold text-red-600">
                      {stat.wrong_count} / {stat.total_attempts}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-1 bg-red-100 text-red-700 font-bold rounded text-xs">
                        {stat.wrong_percent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200 text-gray-700">
                <th className="p-4 text-left font-semibold">Bài test</th>
                <th className="p-4 text-left font-semibold">Thí sinh</th>
                <th className="p-4 text-center font-semibold whitespace-nowrap">Điểm</th>
                <th className="p-4 text-center font-semibold whitespace-nowrap">Kết quả</th>
                <th className="p-4 text-center font-semibold whitespace-nowrap">Thời gian</th>
                <th className="p-4 text-center font-semibold whitespace-nowrap">Vi phạm</th>
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
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs border ${r.passed
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
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${r.violation_count > 0
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-300'
                        }`}
                    >
                      {r.violation_count ?? 0}
                    </span>
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
                  <td colSpan={7} className="p-8 text-center text-gray-500">
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
