'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type QuestionType = 'single' | 'multiple' | 'essay'

type Answer = {
  id: string
  content: string
  is_correct: boolean
  images: string[]
}

type Question = {
  id: string
  content: string
  type: QuestionType
  images: string[]
  answers: Answer[]
}

function parseImages(val: string | null): string[] {
  if (!val) return []
  try {
    if (val.trim().startsWith('[')) {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed.filter((x: any) => typeof x === 'string')
    }
  } catch (e) { }
  return [val]
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

  // Anti-cheat state
  const [violationCount, setViolationCount] = useState(0)
  const [violationReason, setViolationReason] = useState<string | null>(null)
  const [autoLocked, setAutoLocked] = useState(false)
  const [secondsToLock, setSecondsToLock] = useState<number | null>(null)
  const lockTimerRef = useRef<any>(null)

  const [qLoading, setQLoading] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [responses, setResponses] = useState<Record<string, { selected: string[]; essayText: string }>>({})
  const [difficultQuestions, setDifficultQuestions] = useState<Set<string>>(new Set())

  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<Submission | null>(null)

  // ✅ New: Non-blocking notifications
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'info' } | null>(null)
  const showMsg = (text: string, type: 'error' | 'info' = 'info') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  // ✅ Timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

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
    setViolationCount(0)
    setViolationReason(null)
    setAutoLocked(false)
    setSecondsToLock(null)
  }

  // Load test + get stored access code id
  useEffect(() => {
    if (!testId) return

    const load = async () => {
      setLoading(true)

      const { data: t, error: tErr } = await supabase.from('tests').select('*').eq('id', testId).single()

      if (tErr) {
        showMsg(tErr.message, 'error')
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
      // ✅ Security Check: Verify code belongs to this test
      const { data: codeRow, error: codeErr } = await supabase
        .from('test_access_codes')
        .select('test_id')
        .eq('id', accessCodeId)
        .single()

      if (codeErr || !codeRow || codeRow.test_id !== testId) {
        // Mã không khớp bài test này (có thể do lỗi local storage hoặc hack)
        // Reset ngay
        console.warn('Invalid access code for this test, resetting...')
        resetForNewCode()
        return
      }

      // Check submission
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
        .select('id, content, type, image_url')
        .eq('test_id', testId)
        .order('id', { ascending: true })

      if (qErr) {
        showMsg(qErr.message, 'error')
        setQLoading(false)
        return
      }

      const qIds = (qs ?? []).map((q: any) => q.id)

      const ansByQ: Record<string, Answer[]> = {}
      if (qIds.length) {
        const { data: ans, error: aErr } = await supabase
          .from('answers')
          .select('id, question_id, content, is_correct, image_url')
          .in('question_id', qIds)
          .order('id', { ascending: true })

        if (aErr) {
          showMsg(aErr.message, 'error')
          setQLoading(false)
          return
        }

        for (const a of ans ?? []) {
          if (!ansByQ[a.question_id]) ansByQ[a.question_id] = []
          ansByQ[a.question_id].push({
            id: a.id,
            content: a.content ?? '',
            is_correct: !!a.is_correct,
            images: parseImages(a.image_url),
          })
        }
      }

      const mapped: Question[] = (qs ?? []).map((q: any) => ({
        id: q.id,
        content: q.content ?? '',
        type: q.type as QuestionType,
        images: parseImages(q.image_url),
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
    if (!code) return showMsg('Vui lòng nhập mã truy cập', 'error')

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
      return showMsg('Mã không đúng hoặc đã được dùng.', 'error')
    }

    const { error: uErr } = await supabase
      .from('test_access_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('is_used', false)

    if (uErr) {
      setVerifying(false)
      return showMsg(uErr.message, 'error')
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

  const toggleDifficult = (id: string) => {
    setDifficultQuestions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isAnswered = (qId: string) => {
    const res = responses[qId]
    const q = questions.find(x => x.id === qId)
    if (!res || !q) return false
    if (q.type === 'essay') {
      return res.essayText.trim().length > 0
    }
    return res.selected.length > 0
  }

  const scrollToQuestion = (idx: number) => {
    const el = document.getElementById(`question-${idx}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Thêm hiệu ứng nháy để thu hút sự chú ý
      el.classList.add('ring-4', 'ring-blue-400', 'ring-offset-4', 'transition-all', 'duration-500')
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-blue-400', 'ring-offset-4')
      }, 2000)
    }
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

    // ✅ Kiểm tra điền đầy đủ
    const unansweredIdx = questions.findIndex(q => !isAnswered(q.id))
    if (unansweredIdx !== -1) {
      showMsg(`Câu ${unansweredIdx + 1} chưa được trả lời.`, 'error')
      scrollToQuestion(unansweredIdx)
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
        violation_count: violationCount,
      })
      .select('id, score_percent, correct_count, total_count, passed, created_at')
      .single()

    if (insErr) {
      console.warn(insErr)
      showMsg(insErr.message, 'error')
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

  // ✅ Anti-cheat: Fullscreen + Tab switch + Blur + Copy Protection
  useEffect(() => {
    if (!started || submission) return

    const handleViolation = (reason: string) => {
      const newCount = violationCount + 1
      setViolationCount(newCount)
      setViolationReason(reason) // Show custom modal

      // ✅ Check if exceeded max violations
      const maxViolations = Number(test?.max_violations ?? 0)
      if (maxViolations > 0 && newCount >= maxViolations) {
        // Lock the test - will be handled in the modal
        return
      }
    }

    // 1. Chuyển Tab / Minimize
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleViolation('Rời khỏi tab làm bài')
      }
    }

    // 2. Mất focus (Click sang app khác / màn hình khác)
    const handleBlur = () => {
      handleViolation('Mất tập trung vào màn hình làm bài (Blur)')
    }

    // 3. Thoát Fullscreen
    const handleFullScreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation('Thoát chế độ toàn màn hình')
      }
    }

    // 4. Chặn chuột phải & Copy/Paste
    const preventDefault = (e: Event) => e.preventDefault()

    // 5. Bắt phím (F12, PrintScreen, Alt+Tab...)
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen (một số OS/browser chặn, nhưng thử bắt)
      if (e.key === 'PrintScreen') {
        handleViolation('Phát hiện chụp màn hình')
        e.preventDefault()
      }
      // F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('fullscreenchange', handleFullScreenChange)

    // Disable interactions
    document.addEventListener('contextmenu', preventDefault)
    document.addEventListener('copy', preventDefault)
    document.addEventListener('cut', preventDefault)
    document.addEventListener('paste', preventDefault)
    window.addEventListener('keydown', handleKeyDown)

    // Interval check fullscreen (đề phòng thoát bằng cách khác)
    const interval = setInterval(() => {
      if (!document.fullscreenElement && started && !submission) {
        // Chỉ cảnh báo nếu chưa cảnh báo gần đây (avoid loop flood)
        // Tuy nhiên logic trên event listener đã cover, interval chỉ backup
      }
    }, 2000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('fullscreenchange', handleFullScreenChange)
      document.removeEventListener('contextmenu', preventDefault)
      document.removeEventListener('copy', preventDefault)
      document.removeEventListener('cut', preventDefault)
      document.removeEventListener('paste', preventDefault)
      window.removeEventListener('keydown', handleKeyDown)
      clearInterval(interval)
    }
  }, [started, submission, violationCount, test?.max_violations])

  const enterFullScreen = () => {
    try {
      const el = document.documentElement as any
      const requestMethod = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen
      if (requestMethod) {
        requestMethod.call(el).catch((err: any) => console.log('Fullscreen blocked:', err))
      }
    } catch (e) {
      console.error('Fullscreen error:', e)
    }
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h > 0 ? `${h.toString().padStart(2, '0')}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // ✅ Countdown logic
  useEffect(() => {
    if (!started || submission || !testId || !accessCodeId) return

    // Nếu duration_minutes <= 0 hoặc null thì coi như vô hạn
    const durationMins = Number(test?.duration_minutes ?? 0)
    if (durationMins <= 0) {
      setTimeLeft(null)
      return
    }

    const durationSeconds = durationMins * 60
    const startKey = `test_started_at:${testId}:${accessCodeId}`
    const startedAtStr = localStorage.getItem(startKey)

    if (!startedAtStr) return

    const startedAt = new Date(startedAtStr)

    const updateTimer = () => {
      const now = new Date()
      const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
      const remaining = durationSeconds - elapsedSeconds

      if (remaining <= 0) {
        setTimeLeft(0)
        // Auto submit if time is up
        if (!submitting && !submission) {
          console.log('Time is up! Auto-submitting...')
          submit()
        }
      } else {
        setTimeLeft(remaining)
      }
    }

    updateTimer() // run once immediately
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [started, submission, test?.duration_minutes, testId, accessCodeId, submitting])

  // ✅ Anti-cheat: Auto-lock after 30s of being hidden/blurred
  useEffect(() => {
    if (!started || submission || autoLocked) return

    const checkAndStartTimer = () => {
      const isHidden = document.visibilityState === 'hidden'
      const isBlurred = !document.hasFocus()

      if (isHidden || isBlurred) {
        if (!lockTimerRef.current) {
          setSecondsToLock(30)
          lockTimerRef.current = setInterval(() => {
            setSecondsToLock((prev) => {
              if (prev !== null && prev <= 1) {
                setAutoLocked(true)
                if (lockTimerRef.current) clearInterval(lockTimerRef.current)
                lockTimerRef.current = null
                return 0
              }
              return (prev ?? 30) - 1
            })
          }, 1000)
        }
      } else {
        if (lockTimerRef.current) {
          clearInterval(lockTimerRef.current)
          lockTimerRef.current = null
        }
        setSecondsToLock(null)
      }
    }

    // Check every second as a backup, and also listen to events
    const interval = setInterval(checkAndStartTimer, 1000)
    window.addEventListener('focus', checkAndStartTimer)
    window.addEventListener('blur', checkAndStartTimer)
    document.addEventListener('visibilitychange', checkAndStartTimer)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', checkAndStartTimer)
      window.removeEventListener('blur', checkAndStartTimer)
      document.removeEventListener('visibilitychange', checkAndStartTimer)
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current)
        lockTimerRef.current = null
      }
    }
  }, [started, submission, autoLocked])

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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className={`max-w-7xl mx-auto px-6 py-10 ${started ? 'grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6' : 'space-y-6'}`}>
        <div className="space-y-6">
          <div className="bg-white border rounded-xl p-6 shadow-sm">
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
                  if (!name) return showMsg('Vui lòng nhập họ tên', 'error')

                  // lưu tên để refresh không mất
                  localStorage.setItem(nameKey(testId!, accessCodeId!), name)

                  // ✅ lưu thời điểm bắt đầu làm tại đây
                  const startKey = `test_started_at:${testId}:${accessCodeId}`
                  if (!localStorage.getItem(startKey)) {
                    localStorage.setItem(startKey, new Date().toISOString())
                  }

                  enterFullScreen()
                  setTimeout(() => setStarted(true), 100)
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
                <div className="space-y-4 pb-20">
                  {questions.map((q, idx) => (
                    <div key={q.id} id={`question-${idx}`} className="bg-white border rounded-xl p-6 space-y-4 shadow-sm scroll-mt-24">
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-lg text-blue-600">Câu {idx + 1}</div>
                        <button
                          onClick={() => toggleDifficult(q.id)}
                          className={`text-sm px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 font-medium ${difficultQuestions.has(q.id)
                            ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                        >
                          {difficultQuestions.has(q.id) ? '⭐ Khó' : '☆ Đánh dấu khó'}
                        </button>
                      </div>
                      <div className="whitespace-pre-wrap text-lg leading-relaxed">{q.content}</div>
                      {q.images.length > 0 && (
                        <div className="mt-4 flex flex-col gap-4">
                          {q.images.map((img, i) => (
                            <img key={i} src={img} alt="Illustration" className="max-h-96 rounded-lg border object-contain bg-gray-50" />
                          ))}
                        </div>
                      )}

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

                                <div className="flex-1">
                                  <span className="whitespace-pre-wrap">{a.content}</span>
                                  {a.images.length > 0 && (
                                    <div className="mt-2 flex flex-col gap-2">
                                      {a.images.map((img, i) => (
                                        <img key={i} src={img} alt="Answer Illustration" className="max-h-48 rounded border object-contain bg-gray-50" />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="sticky bottom-0 bg-white border-t p-4 flex items-center justify-between gap-3 shadow-top z-50">
                <div className="flex flex-col">
                  <div className="text-red-600 font-bold animate-pulse">
                    {violationCount > 0 ? `⚠️ Vi phạm: ${violationCount} lần` : ''}
                  </div>
                  {timeLeft !== null && (
                    <div className={`text-xl font-black ${timeLeft < 60 ? 'text-red-600 animate-bounce' : 'text-gray-900'}`}>
                      ⏱️ {formatTime(timeLeft)}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={resetForNewCode} className="px-5 py-3 rounded-xl bg-gray-200 text-gray-900 font-semibold text-sm">
                    Đổi mã khác
                  </button>

                  <button
                    onClick={submit}
                    disabled={submitting || qLoading || questions.length === 0}
                    className="px-8 py-3 rounded-xl bg-[#00a0fa] text-white font-bold text-lg disabled:opacity-50"
                  >
                    {submitting ? 'Đang nộp...' : 'Nộp bài'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ✅ SIDEBAR TỔNG HỢP CÂU HỎI */}
        {started && !loading && questions.length > 0 && (
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <h2 className="font-bold text-lg mb-4 flex items-center justify-between">
                  <span>Danh sách câu hỏi</span>
                  <span className="text-sm font-normal text-gray-500">
                    {questions.filter(q => isAnswered(q.id)).length}/{questions.length}
                  </span>
                </h2>

                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const answered = isAnswered(q.id)
                    const difficult = difficultQuestions.has(q.id)
                    return (
                      <button
                        key={q.id}
                        onClick={() => scrollToQuestion(idx)}
                        className={`
                          w-full aspect-square rounded-lg flex items-center justify-center text-sm font-bold border transition-all
                          ${answered
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400'
                          }
                          ${difficult ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}
                        `}
                      >
                        {idx + 1}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100 space-y-3 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-600" />
                    <span>Đã trả lời</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border border-gray-200" />
                    <span>Chưa trả lời</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border-2 border-yellow-400" />
                    <span>Câu hỏi khó</span>
                  </div>
                </div>
              </div>

              {timeLeft !== null && (
                <div className={`bg-white border rounded-xl p-6 shadow-sm text-center ${timeLeft < 60 ? 'border-red-500 bg-red-50' : ''}`}>
                  <div className="text-sm text-gray-500 mb-1">Thời gian còn lại</div>
                  <div className={`text-3xl font-black ${timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>
                    {formatTime(timeLeft)}
                  </div>
                </div>
              )}

              <button
                onClick={submit}
                disabled={submitting || qLoading || questions.length === 0}
                className="w-full py-4 rounded-xl bg-primary text-white font-bold text-lg shadow-lg shadow-orange-200 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? 'ĐANG NỘP...' : 'NỘP BÀI'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ FLOATING NOTIFICATION (Thay cho alert) */}
      {msg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-white ${msg.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
            }`}>
            {msg.type === 'error' ? '❌' : 'ℹ️'}
            {msg.text}
          </div>
        </div>
      )}

      {/* 🔴 WARNING MODAL (Thay cho alert để không bị exit fullscreen) */}
      {violationReason && (() => {
        const maxViolations = Number(test?.max_violations ?? 0)
        const isLocked = (maxViolations > 0 && violationCount >= maxViolations) || autoLocked
        const lockReason = autoLocked ? 'Rời khỏi màn hình quá 30 giây' : violationReason

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 text-white p-6 animate-in fade-in duration-200">
            <div className={`max-w-md w-full rounded-xl p-8 shadow-2xl text-center space-y-6 border-4 ${isLocked ? 'bg-black border-red-600' : 'bg-red-600 border-white'
              }`}>
              <div className="text-6xl">{isLocked ? '🔒' : '⚠️'}</div>
              <h2 className="text-3xl font-black uppercase tracking-wider">
                {isLocked ? 'Bài làm đã bị khóa!' : 'Cảnh báo vi phạm!'}
              </h2>

              <div className={`text-lg font-medium p-4 rounded-lg ${isLocked ? 'bg-red-900/50' : 'bg-red-700/50'
                }`}>
                {lockReason}
              </div>

              {!isLocked && secondsToLock !== null && (
                <div className="text-2xl font-black text-white bg-black/30 p-4 rounded-xl animate-pulse border border-white/20">
                  ⚠️ QUAY LẠI NGAY! <br />
                  Tự động khóa sau: <span className="text-yellow-400">{secondsToLock}s</span>
                </div>
              )}

              <div className="text-xl font-bold">
                Vi phạm: {violationCount} {maxViolations > 0 ? `/ ${maxViolations}` : ''} lần
              </div>

              {isLocked ? (
                <>
                  <p className="text-white/90">
                    Bạn đã vượt quá số lần vi phạm cho phép.
                    <br />
                    Bài làm của bạn đã bị khóa và không thể tiếp tục.
                  </p>
                  <button
                    onClick={() => {
                      setViolationReason(null)
                      // Force submit with current answers
                      submit()
                    }}
                    className="w-full py-4 bg-white text-black font-bold text-xl rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    NỘP BÀI NGAY
                  </button>
                </>
              ) : (
                <>
                  <p className="text-white/90">
                    Hệ thống đã ghi lại hành vi bất thường của bạn.
                    <br />
                    {maxViolations > 0 && `Còn ${maxViolations - violationCount} lần vi phạm trước khi bị khóa.`}
                  </p>

                  <button
                    onClick={() => {
                      setViolationReason(null)
                      // ✅ KHÔNG tự động bật lại fullscreen - chỉ đóng modal
                    }}
                    className="w-full py-4 bg-white text-red-600 font-bold text-xl rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    ĐÃ HIỂU
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })()}

      <style jsx global>{`
        /* Chặn select text khi đang làm bài + ẩn scrollbar nếu cần */
        body.take-test-mode {
          user-select: none;
          -webkit-user-select: none;
          overflow-x: hidden;
        }
        body.take-test-mode aside,
        body.take-test-mode .sidebar {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
