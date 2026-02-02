'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'


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
  bank_id?: string | null
  current_difficulty?: string
  suggested_difficulty?: string
}

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds === undefined) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default function ReportsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [subs, setSubs] = useState<SubmissionRow[]>([])
  const [testsMap, setTestsMap] = useState<Record<string, TestRow>>({})
  const [wrongStats, setWrongStats] = useState<WrongQuestionStat[]>([])
  const [selectedTestId, setSelectedTestId] = useState<string>('all')

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
              .select('id, content, test_id, bank_question_id')
              .in('id', topQIds)

            const relatedTestIds = Array.from(new Set(qs?.map((q: any) => q.test_id))).filter(Boolean) as string[]
            const bankIds = Array.from(new Set(qs?.map((q: any) => q.bank_question_id))).filter(Boolean) as string[]

            const { data: ts } = await supabase.from('tests').select('id, title').in('id', relatedTestIds)
            const tMap = new Map((ts ?? []).map((t: any) => [t.id, t.title]))

            // Fetch bank difficulty
            const { data: bankQs } = bankIds.length > 0
              ? await supabase.from('question_bank').select('id, difficulty').in('id', bankIds)
              : { data: [] }
            const bankMap = new Map((bankQs ?? []).map((b: any) => [b.id, b.difficulty]))

            const finalStats: WrongQuestionStat[] = sorted.map(([qId, stat]) => {
              const q = qs?.find((x: any) => x.id === qId)
              const testTitle = q ? (tMap.get(q.test_id) as string || 'Unknown') : 'Unknown'
              const wp = stat.total > 0 ? Math.round((stat.wrong / stat.total) * 100) : 0

              let suggested = 'Easy'
              if (wp > 80) suggested = 'Hard'
              else if (wp > 50) suggested = 'Medium'

              return {
                question_id: qId,
                content: q?.content ?? 'Unknown',
                test_title: String(testTitle),
                wrong_count: stat.wrong,
                total_attempts: stat.total,
                wrong_percent: wp,
                bank_id: q?.bank_question_id,
                current_difficulty: q?.bank_question_id ? (bankMap.get(q.bank_question_id) as string || 'Easy') : undefined,
                suggested_difficulty: suggested
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

  const updateBankDifficulty = async (bankId: string, newDiff: string) => {
    const { error } = await supabase
      .from('question_bank')
      .update({ difficulty: newDiff })
      .eq('id', bankId)

    if (error) alert(error.message)
    else {
      alert('✅ Đã cập nhật độ khó trong ngân hàng!')
      // Refresh local state
      setWrongStats(current => current.map(s => s.bank_id === bankId ? { ...s, current_difficulty: newDiff } : s))
    }
  }

  const filteredSubs = useMemo(() => {
    if (selectedTestId === 'all') return subs
    return subs.filter(s => s.test_id === selectedTestId)
  }, [subs, selectedTestId])

  const rows = useMemo(() => {
    return filteredSubs.map(s => ({
      ...s,
      test_title: testsMap[s.test_id]?.title ?? s.test_id,
    }))
  }, [filteredSubs, testsMap])

  // --- Analytics Calculations ---
  const stats = useMemo(() => {
    if (filteredSubs.length === 0) return null

    const total = filteredSubs.length
    const passedCount = filteredSubs.filter(s => s.passed).length
    const avgScore = Math.round(filteredSubs.reduce((acc, s) => acc + s.score_percent, 0) / total)

    // Distribution
    const bins = [
      { name: '0-20%', value: 0 },
      { name: '21-40%', value: 0 },
      { name: '41-60%', value: 0 },
      { name: '61-80%', value: 0 },
      { name: '81-100%', value: 0 }
    ]
    filteredSubs.forEach(s => {
      const p = s.score_percent
      if (p <= 20) bins[0].value++
      else if (p <= 40) bins[1].value++
      else if (p <= 60) bins[2].value++
      else if (p <= 80) bins[3].value++
      else bins[4].value++
    })

    const passFailData = [
      { name: 'Đạt', value: passedCount, color: '#22c55e' },
      { name: 'Chưa Đạt', value: total - passedCount, color: '#ef4444' }
    ]

    return { total, passedCount, avgScore, bins, passFailData }
  }, [filteredSubs])

  if (loading) return <div className="p-6 text-gray-600">Đang tải...</div>
  if (error) return <div className="p-6 text-red-600">Lỗi: {error}</div>

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Phân tích kết quả</h1>
          <p className="mt-1 text-slate-500 font-medium italic">Dữ liệu thông minh giúp tối ưu hóa chất lượng đào tạo.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lọc theo bài thi</label>
          <select
            value={selectedTestId}
            onChange={e => setSelectedTestId(e.target.value)}
            className="h-12 px-6 bg-white border-2 border-slate-100 rounded-2xl font-bold shadow-sm focus:border-orange-500 outline-none transition-all"
          >
            <option value="all">Tất cả bài thi</option>
            {Object.values(testsMap).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary Cards */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-[32px] text-white shadow-xl shadow-orange-200">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Tổng bài làm</div>
              <div className="text-5xl font-black mt-2">{stats.total}</div>
              <div className="text-xs mt-2 font-bold opacity-90"> submissions được ghi nhận</div>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tỉ lệ Đạt (Pass Rate)</div>
              <div className="text-5xl font-black mt-2 text-green-600">{Math.round((stats.passedCount / stats.total) * 100)}%</div>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${(stats.passedCount / stats.total) * 100}%` }} />
              </div>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Điểm số trung bình</div>
              <div className="text-5xl font-black mt-2 text-slate-800">{stats.avgScore}%</div>
              <div className="text-xs mt-2 font-bold text-slate-400 flex items-center gap-1">
                Trình độ trung bình của thí sinh
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
            <h2 className="text-xl font-black text-slate-900 uppercase">Biểu đồ phổ điểm</h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.bins}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800 }}
                  />
                  <Bar dataKey="value" fill="#f97316" radius={[10, 10, 10, 10]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6 flex flex-col items-center">
            <h2 className="text-xl font-black text-slate-900 uppercase w-full">Tỉ lệ Đạt/Trượt</h2>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.passFailData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {stats.passFailData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-slate-800">{stats.passedCount} <span className="text-xs text-slate-400 uppercase">Thí sinh đạt</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Section - Question Difficulty */}
      {wrongStats.length > 0 && (
        <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">Phân tích độ khó và kiến thức hổng</h2>
              <p className="text-slate-400 text-sm font-medium">Nhận diện các câu hỏi có tỉ lệ trả lời sai cao nhất để điều chỉnh nội dung đào tạo.</p>
            </div>
            <span className="bg-orange-500/20 text-orange-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-500/30">Chỉ số trọng tâm</span>
          </div>

          <div className="space-y-4">
            {wrongStats.map((stat: WrongQuestionStat, i: number) => (
              <div
                key={stat.question_id}
                onClick={() => {
                  if (stat.bank_id) {
                    router.push(`/question-bank#${stat.bank_id}`)
                  }
                }}
                className={`bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all flex items-center gap-6 group ${stat.bank_id ? 'cursor-pointer' : ''}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center font-black text-xl shadow-lg shadow-orange-500/20">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                    {stat.test_title}
                  </div>
                  <div className="font-bold text-lg text-slate-200 truncate group-hover:text-white transition-colors" title={stat.content}>
                    {stat.content}
                  </div>
                </div>
                <div className="text-right flex items-center gap-6">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Số lần sai</div>
                    <div className="font-black text-xl">{stat.wrong_count} / {stat.total_attempts}</div>
                  </div>
                  <div className="w-20 text-center">
                    <div className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Tỉ lệ sai</div>
                    <div className="text-2xl font-black text-red-500">{stat.wrong_percent}%</div>
                  </div>

                  <div className="flex flex-col items-center gap-2 border-l border-white/10 pl-6 min-w-[140px]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trạng thái độ khó</div>

                    {!stat.bank_id ? (
                      <div className="text-[10px] text-slate-500 font-bold bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 italic">
                        Chưa liên kết ngân hàng
                      </div>
                    ) : stat.current_difficulty === stat.suggested_difficulty ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${stat.current_difficulty === 'Hard' ? 'bg-red-500 text-white' :
                          stat.current_difficulty === 'Medium' ? 'bg-orange-500 text-white' :
                            'bg-green-500 text-white'
                          }`}>
                          {stat.current_difficulty === 'Hard' ? 'Khó' : stat.current_difficulty === 'Medium' ? 'T.Bình' : 'Dễ'}
                        </span>
                        <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter">✓ Đã tối ưu</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500 line-through">
                            {stat.current_difficulty === 'Hard' ? 'Khó' : stat.current_difficulty === 'Medium' ? 'T.Bình' : 'Dễ'}
                          </span>
                          <span className="text-slate-400">➔</span>
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase animate-pulse ${stat.suggested_difficulty === 'Hard' ? 'bg-red-500 text-white' :
                            stat.suggested_difficulty === 'Medium' ? 'bg-orange-500 text-white' :
                              'bg-green-500 text-white'
                            }`}>
                            {stat.suggested_difficulty === 'Hard' ? 'Khó' : stat.suggested_difficulty === 'Medium' ? 'T.Bình' : 'Dễ'}
                          </span>
                        </div>
                        <button
                          onClick={() => updateBankDifficulty(stat.bank_id!, stat.suggested_difficulty!)}
                          className="w-full text-[9px] font-black bg-orange-500 text-white hover:bg-orange-600 px-3 py-2 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-95"
                        >
                          CẬP NHẬT NGÂN HÀNG
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-100 rounded-[40px] shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 uppercase">Danh sách bài thi chi tiết</h2>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hiển thị {rows.length} kết quả</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 text-left border-b border-slate-100">
                <th className="p-6">Bài làm & Thời gian</th>
                <th className="p-6">Thí sinh</th>
                <th className="p-6 text-center">Điểm số</th>
                <th className="p-6 text-center">Kết quả</th>
                <th className="p-6 text-center">Làm bài</th>
                <th className="p-6 text-center">Vi phạm</th>
                <th className="p-6 text-center">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50">
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="p-6">
                    <div className="font-bold text-slate-800 text-base">{(r as any).test_title}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(r.created_at).toLocaleString('vi-VN')}</div>
                  </td>

                  <td className="p-6">
                    <div className="font-black text-slate-700 uppercase tracking-tight">
                      {r.candidate_name?.trim() || 'KHẨN DANH'}
                    </div>
                  </td>

                  <td className="p-6 text-center whitespace-nowrap">
                    <div className="font-black text-lg text-slate-900">{r.score_percent}%</div>
                    <div className="text-[10px] font-bold text-slate-400">({r.correct_count}/{r.total_count})</div>
                  </td>

                  <td className="p-6 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest border-2 ${r.passed
                        ? 'border-green-200 bg-green-50 text-green-600'
                        : 'border-red-200 bg-red-50 text-red-600'
                        }`}
                    >
                      {r.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                    </span>
                  </td>

                  <td className="p-6 text-center text-slate-600 font-bold whitespace-nowrap">
                    {formatDuration(r.duration_seconds)}
                  </td>

                  <td className="p-6 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black ${r.violation_count > 0
                        ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                        : 'bg-slate-100 text-slate-400'
                        }`}
                    >
                      {r.violation_count ?? 0}
                    </span>
                  </td>

                  <td className="p-6 text-center whitespace-nowrap">
                    <Link
                      href={`/reports/${r.id}`}
                      className="inline-flex items-center justify-center px-6 py-2 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-orange-500 transition-all active:scale-95 shadow-lg shadow-slate-200"
                    >
                      CHI TIẾT
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
