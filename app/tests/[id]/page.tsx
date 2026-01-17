'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type QuestionType = 'single' | 'multiple' | 'essay'

type Answer = {
  id: string
  content: string
  is_correct: boolean
}

type Question = {
  id: string
  content: string
  type: QuestionType
  answers: Answer[]
}

type Submission = {
  score_percent: number
  correct_count: number
  total_count: number
  passed: boolean
  created_at: string
}

const storageKey = (testId: string) => `test_access_code_id:${testId}`
const nameKey = (testId: string, accessCodeId: string) => `candidate_name:${testId}:${accessCodeId}`

export default function TakeTestPage() {
  const supabase = createClient()
  const params = useParams<{ id: string }>()
  const testId = params?.id

  const [loading, setLoading] = useState(true)
  const [test, setTest] = useState<any>(null)

  const [codeInput, setCodeInput] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [accessCodeId, setAccessCodeId] = useState<string | null>(null)

  // ✅ NEW: tên + trạng thái đã bấm bắt đầu chưa
  const [candidateName, setCandidateName] = useState('')
  const [started, setStarted] = useState(false)
  const [violationCount, setViolationCount] = useState(0)

  const [qLoading, setQLoading] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [responses, setResponses] = useState<Record<string, { selected: string[]; essayText: string }>>({})

  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<Submission | null>(null)

  const title = useMemo(() => test?.title || 'Làm bài kiểm tra', [test?.title])

  // Ẩn sidebar nhanh
  useEffect(() => {
    document.body.classList.add('take-test-mode')
    return () => document.body.classList.remove('take-test-mode')
  }, [])

  // ✅ RESET để nhập mã mới / làm lại bằng code mới
  const resetForNewCode = () => {
    if (!testId) return
    localStorage.removeItem(storageKey(testId))
    setAccessCodeId(null)
    setSubmission(null)
    setQuestions([])
    setResponses({})
    setCodeInput('')

    // NEW reset name/start
    setCandidateName('')
    setStarted(false)
  }

  // Load test + get stored access code id
  useEffect(() => {
    if (!testId) return

    const load = async () => {
      setLoading(true)

      const { data: t, error: tErr } = await supabase.from('tests').select('*').eq('id', testId).single()

      if (tErr) {
        alert(tErr.message)
        setLoading(false)
        return
      }

      setTest(t)

      if (t.status !== 'published') {
        setLoading(false)
        return
      }

      const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey(testId)) : null
      setAccessCodeId(stored)
      setLoading(false)
    }

    load()
  }, [testId])

  // ✅ NEW: nếu refresh mà đã nhập tên trước đó thì load lại tên + started
  useEffect(() => {
    if (!testId) return
    if (!accessCodeId) {
      setCandidateName('')
      setStarted(false)
      return
    }

    const savedName = localStorage.getItem(nameKey(testId, accessCodeId)) || ''
    if (savedName.trim()) {
      setCandidateName(savedName)
      setStarted(true)
    } else {
      setCandidateName('')
      setStarted(false)
    }
  }, [testId, accessCodeId])

  // If have accessCodeId => check submission (đã nộp chưa)
  useEffect(() => {
    if (!testId) return
    if (!accessCodeId) return
    if (test?.status !== 'published') return

    const check = async () => {
      const { data, error } = await supabase
        .from('test_submissions')
        .select('score_percent, correct_count, total_count, passed, created_at')
        .eq('test_id', testId)
        .eq('access_code_id', accessCodeId)
        .maybeSingle()

      if (error) {
        console.warn(error)
        return
      }

      if (data) {
        setSubmission({
          score_percent: data.score_percent,
          correct_count: data.correct_count,
          total_count: data.total_count,
          passed: data.passed,
          created_at: data.created_at,
        })
      } else {
        setSubmission(null)
      }
    }

    check()
  }, [testId, accessCodeId, test?.status])

  // Load questions only when:
  // - published
  // - have accessCodeId
  // - NOT submitted yet
  useEffect(() => {
    if (!testId) return
    if (test?.status !== 'published') return
    if (!accessCodeId) return
    if (submission) return

    const loadQuestions = async () => {
      setQLoading(true)

      const { data: qs, error: qErr } = await supabase
        .from('questions')
        .select('id, content, type')
        .eq('test_id', testId)
        .order('id', { ascending: true })

      if (qErr) {
        alert(qErr.message)
        setQLoading(false)
        return
      }

      const qIds = (qs ?? []).map((q: any) => q.id)

      const ansByQ: Record<string, Answer[]> = {}
      if (qIds.length) {
        const { data: ans, error: aErr } = await supabase
          .from('answers')
          .select('id, question_id, content, is_correct')
          .in('question_id', qIds)
          .order('id', { ascending: true })

        if (aErr) {
          alert(aErr.message)
          setQLoading(false)
          return
        }

        for (const a of ans ?? []) {
          if (!ansByQ[a.question_id]) ansByQ[a.question_id] = []
          ansByQ[a.question_id].push({
            id: a.id,
            content: a.content ?? '',
            is_correct: !!a.is_correct,
          })
        }
      }

      const mapped: Question[] = (qs ?? []).map((q: any) => ({
        id: q.id,
        content: q.content ?? '',
        type: q.type as QuestionType,
        answers: q.type === 'essay' ? [] : ansByQ[q.id] ?? [],
      }))

      setQuestions(mapped)

      const init: Record<string, { selected: string[]; essayText: string }> = {}
      for (const q of mapped) init[q.id] = { selected: [], essayText: '' }
      setResponses(init)

      setQLoading(false)
    }

    loadQuestions()
  }, [testId, test?.status, accessCodeId, submission])

  const verifyAndConsume = async () => {
    if (!testId) return
    const code = codeInput.trim().toUpperCase()
    if (!code) return alert('Nhập mã')

    setVerifying(true)

    const { data: row, error } = await supabase
      .from('test_access_codes')
      .select('id')
      .eq('test_id', testId)
      .eq('code', code)
      .eq('is_used', false)
      .single()

    if (error) {
      setVerifying(false)
      return alert('Mã không đúng hoặc đã được dùng.')
    }

    const { error: uErr } = await supabase
      .from('test_access_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('is_used', false)

    if (uErr) {
      setVerifying(false)
      return alert(uErr.message)
    }

    localStorage.setItem(storageKey(testId), row.id)
    setAccessCodeId(row.id)
    setSubmission(null)

    // ✅ IMPORTANT: KHÔNG set started_at ở đây nữa
    // started_at sẽ set khi bấm "Bắt đầu làm bài"
    setCandidateName('')
    setStarted(false)

    setVerifying(false)
  }

  const toggleSingle = (questionId: string, answerId: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], selected: [answerId] },
    }))
  }

  const toggleMultiple = (questionId: string, answerId: string) => {
    setResponses(prev => {
      const cur = prev[questionId]?.selected ?? []
      const exists = cur.includes(answerId)
      const next = exists ? cur.filter(x => x !== answerId) : [...cur, answerId]
      return {
        ...prev,
        [questionId]: { ...prev[questionId], selected: next },
      }
    })
  }

  const setEssay = (questionId: string, text: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], essayText: text },
    }))
  }

  const arraysEqualAsSet = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    const sa = new Set(a)
    for (const x of b) if (!sa.has(x)) return false
    return true
  }

  const submit = async () => {
    if (submitting) return
    if (!testId || !accessCodeId) return

    // ✅ bắt buộc có tên
    const name = candidateName.trim() || localStorage.getItem(nameKey(testId, accessCodeId)) || ''
    if (!name.trim()) {
      alert('Vui lòng nhập họ tên trước khi làm bài.')
      return
    }

    setSubmitting(true)

    const gradable = questions.filter(q => q.type !== 'essay')
    const total = gradable.length

    let correct = 0
    for (const q of gradable) {
      const correctIds = q.answers.filter(a => a.is_correct).map(a => a.id)
      const selected = responses[q.id]?.selected ?? []
      if (arraysEqualAsSet(selected, correctIds)) correct += 1
    }

    const percent = total === 0 ? 0 : Math.round((correct / total) * 100)
    const passScore = Number(test?.pass_score ?? 0)
    const passed = percent >= passScore

    // ✅ time tracking (bắt đầu từ lúc bấm "Bắt đầu làm bài")
    const startKey = `test_started_at:${testId}:${accessCodeId}`
    const startedAtStr = localStorage.getItem(startKey)
    const startedAt = startedAtStr ? new Date(startedAtStr) : null
    const submittedAt = new Date()

    const durationSeconds =
      startedAt && !Number.isNaN(startedAt.getTime())
        ? Math.max(0, Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000))
        : null

    // ✅ 1) insert submission và lấy id
    const { data: inserted, error: insErr } = await supabase
      .from('test_submissions')
      .insert({
        test_id: testId,
        access_code_id: accessCodeId,
        candidate_name: name, // ✅ LƯU TÊN Ở ĐÂY
        score_percent: percent,
        correct_count: correct,
        total_count: total,
        passed,
        started_at: startedAt ? startedAt.toISOString() : null,
        submitted_at: submittedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .select('id, score_percent, correct_count, total_count, passed, created_at')
      .single()

    if (insErr) {
      console.warn(insErr)
      alert(insErr.message)
      setSubmitting(false)
      return
    }

    const submissionId = inserted.id

    // ✅ 2) insert chi tiết bài làm
    const detailPayload = questions.map(q => {
      const selected = responses[q.id]?.selected ?? []
      const essayText = responses[q.id]?.essayText ?? ''

      let isCorrect: boolean | null = null
      if (q.type !== 'essay') {
        const correctIds = q.answers.filter(a => a.is_correct).map(a => a.id)
        isCorrect = arraysEqualAsSet(selected, correctIds)
      }

      return {
        submission_id: submissionId,
        question_id: q.id,
        selected_answer_ids: q.type === 'essay' ? null : selected,
        essay_text: q.type === 'essay' ? essayText : null,
        is_correct: isCorrect,
      }
    })

    const { error: dErr } = await supabase.from('test_submission_answers').insert(detailPayload)
    if (dErr) console.warn(dErr)

    // ✅ 3) set state submission để khóa làm lại
    setSubmission({
      score_percent: inserted.score_percent,
      correct_count: inserted.correct_count,
      total_count: inserted.total_count,
      passed: inserted.passed,
      created_at: inserted.created_at,
    })

    setSubmitting(false)
  }

  // ✅ Anti-cheat: Fullscreen + Tab switch detection
  useEffect(() => {
    if (!started || submission) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setViolationCount(prev => prev + 1)
      } else if (document.visibilityState === 'visible') {
        // Hiện cảnh báo khi quay lại tab
        alert('⚠️ CẢNH BÁO: Hệ thống phát hiện bạn đã chuyển tab hoặc rời khỏi màn hình! Vi phạm này đã bị ghi lại.')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [started, submission])

  const enterFullScreen = () => {
    try {
      const el = document.documentElement as any
      const requestMethod = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen
      if (requestMethod) {
        requestMethod.call(el)
      }
    } catch (e) {
      console.error('Fullscreen error:', e)
    }
  }

  const message = useMemo(() => {
    if (!submission) return ''
    return submission.passed
      ? (test?.success_message ?? '✅ Bạn đã đạt bài test.')
      : (test?.fail_message ?? '❌ Bạn chưa đạt bài test.')
  }, [submission, test?.success_message, test?.fail_message])

  if (loading) return <div className="p-8">Đang tải...</div>

  if (test?.status !== 'published') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-white text-gray-900">
        <div className="max-w-lg w-full border rounded-xl p-6">
          <div className="text-2xl font-bold">Bài kiểm tra chưa được xuất bản</div>
          <div className="text-gray-600 mt-2">Bạn chưa thể vào làm bài.</div>
        </div>

        <style jsx global>{`
          body.take-test-mode aside,
          body.take-test-mode .sidebar {
            display: none !important;
          }
        `}</style>
      </div>
    )
  }

  // ✅ ĐÃ NỘP
  if (submission) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-white text-gray-900">
        <div className="max-w-xl w-full border rounded-xl p-6 space-y-4">
          <div className="text-2xl font-bold">{title}</div>

          <div className={`border rounded-xl p-4 ${submission.passed ? 'border-green-300' : 'border-red-300'}`}>
            <div className="text-xl font-bold">{submission.passed ? '✅ ĐẠT' : '❌ CHƯA ĐẠT'}</div>
            <div className="mt-2">
              Điểm: <b>{submission.score_percent}%</b> ({submission.correct_count}/{submission.total_count} câu trắc nghiệm đúng)
            </div>
            <div className="mt-2 text-gray-700">{message}</div>
            <div className="mt-2 text-sm text-gray-500">Bạn đã nộp bài và không thể làm lại bằng mã cũ.</div>
          </div>

          <button onClick={resetForNewCode} className="w-full px-5 py-3 rounded-lg bg-[#ff5200] text-white font-semibold">
            Dùng mã khác để làm lại
          </button>
        </div>

        <style jsx global>{`
          body.take-test-mode aside,
          body.take-test-mode .sidebar {
            display: none !important;
          }
        `}</style>
      </div>
    )
  }

  // chưa có accessCodeId => hỏi mã
  if (!accessCodeId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-white text-gray-900">
        <div className="max-w-lg w-full border rounded-xl p-6 space-y-4">
          <div className="text-2xl font-bold">{title}</div>
          <div className="text-gray-600">
            Vui lòng nhập <b>mã truy cập 1 lần</b> để mở bài test.
          </div>

          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            placeholder="Nhập mã (VD: ABCD1234)"
            className="w-full h-11 px-3 border border-gray-300 rounded-lg font-mono"
          />

          <button
            onClick={verifyAndConsume}
            disabled={verifying}
            className="w-full px-5 py-3 rounded-lg bg-[#ff5200] text-white font-semibold disabled:opacity-50"
          >
            {verifying ? 'Đang kiểm tra...' : 'Mở bài test'}
          </button>
        </div>

        <style jsx global>{`
          body.take-test-mode aside,
          body.take-test-mode .sidebar {
            display: none !important;
          }
        `}</style>
      </div>
    )
  }

  // access ok & chưa nộp => vào bài (nhưng phải nhập tên + bấm bắt đầu)
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="border rounded-xl p-6">
          <h1 className="text-3xl font-bold">{title}</h1>
          {test?.description && <div className="text-gray-600 mt-2">{test.description}</div>}
          <div className="text-sm text-gray-500 mt-2">* Tự luận không chấm tự động (không tính vào %).</div>
        </div>

        {/* ✅ BƯỚC NHẬP TÊN */}
        {!started && (
          <div className="border rounded-xl p-6 space-y-4">
            <div className="text-lg font-semibold">Nhập thông tin thí sinh</div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Họ tên</label>
              <input
                value={candidateName}
                onChange={e => setCandidateName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full h-11 px-3 border border-gray-300 rounded-lg"
              />
            </div>

            <button
              onClick={() => {
                const name = candidateName.trim()
                if (!name) return alert('Vui lòng nhập họ tên')

                // lưu tên để refresh không mất
                localStorage.setItem(nameKey(testId!, accessCodeId!), name)

                // ✅ lưu thời điểm bắt đầu làm tại đây
                const startKey = `test_started_at:${testId}:${accessCodeId}`
                if (!localStorage.getItem(startKey)) {
                  localStorage.setItem(startKey, new Date().toISOString())
                }

                enterFullScreen()
                setStarted(true)
              }}
              className="w-full px-5 py-3 rounded-lg bg-[#00a0fa] text-white font-semibold"
            >
              Bắt đầu làm bài
            </button>

            <button onClick={resetForNewCode} className="w-full px-5 py-3 rounded-lg bg-gray-200 text-gray-900 font-semibold">
              Đổi mã khác
            </button>
          </div>
        )}

        {/* ✅ CHỈ HIỆN CÂU HỎI KHI ĐÃ STARTED */}
        {started && (
          <>
            {qLoading ? (
              <div>Đang tải câu hỏi...</div>
            ) : questions.length === 0 ? (
              <div className="border rounded-xl p-6 text-gray-600">Test này chưa có câu hỏi.</div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="border rounded-xl p-6 space-y-4">
                    <div className="font-semibold">Câu {idx + 1}</div>
                    <div className="whitespace-pre-wrap">{q.content}</div>

                    {q.type === 'essay' ? (
                      <textarea
                        value={responses[q.id]?.essayText ?? ''}
                        onChange={e => setEssay(q.id, e.target.value)}
                        placeholder="Nhập câu trả lời..."
                        className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    ) : (
                      <div className="space-y-2">
                        {q.answers.map(a => {
                          const selected = (responses[q.id]?.selected ?? []).includes(a.id)
                          return (
                            <label key={a.id} className="flex items-start gap-2 cursor-pointer border rounded-lg px-3 py-2">
                              <input
                                type={q.type === 'single' ? 'radio' : 'checkbox'}
                                checked={selected}
                                onChange={() => {
                                  if (q.type === 'single') toggleSingle(q.id, a.id)
                                  else toggleMultiple(q.id, a.id)
                                }}
                              />
                              <span className="whitespace-pre-wrap">{a.content}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="sticky bottom-0 bg-white border-t p-4 flex items-center justify-between gap-3">
              <button onClick={resetForNewCode} className="px-5 py-3 rounded-xl bg-gray-200 text-gray-900 font-semibold">
                Đổi mã khác
              </button>

              <button
                onClick={submit}
                disabled={submitting || qLoading || questions.length === 0}
                className="px-6 py-3 rounded-xl bg-[#00a0fa] text-white font-bold disabled:opacity-50"
              >
                {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        body.take-test-mode aside,
        body.take-test-mode .sidebar {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
