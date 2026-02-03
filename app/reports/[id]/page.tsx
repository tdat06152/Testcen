'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  id: string
  test_id: string
  candidate_name: string | null
  access_code_id: string
  score_percent: number
  correct_count: number
  total_count: number
  passed: boolean
  started_at: string | null
  submitted_at: string | null
  duration_seconds: number | null
  violation_count: number
  created_at: string
}

type SubmissionAnswer = {
  id: string
  submission_id: string
  question_id: string
  selected_answer_ids: string[] | null
  essay_text: string | null
  is_correct: boolean | null
}

type ViolationLog = {
  id: string
  violation_reason: string
  violated_at: string
  created_at: string
}

function formatDuration(seconds: number | null) {
  if (!seconds && seconds !== 0) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDateTime(isoString: string | null) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function ReportDetailPage() {
  const supabase = createClient()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const submissionId = params?.id

  const [loading, setLoading] = useState(true)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [subAnswers, setSubAnswers] = useState<SubmissionAnswer[]>([])
  const [violationLogs, setViolationLogs] = useState<ViolationLog[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      if (!submissionId) return
      setLoading(true)
      setError(null)

      const { data: sub, error: subErr } = await supabase
        .from('test_submissions')
        .select('*')
        .eq('id', submissionId)
        .single()

      if (subErr || !sub) {
        setError(subErr?.message ?? 'Không tìm thấy submission')
        setLoading(false)
        return
      }
      setSubmission(sub)

      const { data: sa, error: saErr } = await supabase
        .from('test_submission_answers')
        .select('*')
        .eq('submission_id', submissionId)

      if (saErr) {
        setError(saErr.message)
        setLoading(false)
        return
      }
      setSubAnswers(sa ?? [])

      const { data: qsRaw, error: qsErr } = await supabase
        .from('questions')
        .select('id, content, type')
        .eq('test_id', sub.test_id)

      if (qsErr) {
        setError(qsErr.message)
        setLoading(false)
        return
      }

      const qs = (qsRaw ?? []) as Array<{ id: string; content: string; type: QuestionType }>
      const questionIds = qs.map(q => q.id)

      const answersByQuestion = new Map<string, Answer[]>()
      if (questionIds.length > 0) {
        const { data: ansRaw, error: ansErr } = await supabase
          .from('answers')
          .select('id, question_id, content, is_correct')
          .in('question_id', questionIds)

        if (ansErr) {
          setError(ansErr.message)
          setLoading(false)
          return
        }

        for (const a of (ansRaw ?? []) as any[]) {
          const arr = answersByQuestion.get(a.question_id) ?? []
          arr.push({ id: a.id, content: a.content, is_correct: a.is_correct })
          answersByQuestion.set(a.question_id, arr)
        }
      }

      const merged: Question[] = qs.map(q => ({
        id: q.id,
        content: q.content,
        type: q.type,
        answers: answersByQuestion.get(q.id) ?? [],
      }))

      setQuestions(merged)

      // ✅ Fetch violation logs
      const { data: logs, error: logsErr } = await supabase
        .from('test_violation_logs')
        .select('id, violation_reason, violated_at, created_at')
        .eq('access_code_id', sub.access_code_id)
        .order('violated_at', { ascending: true })

      if (!logsErr && logs) {
        setViolationLogs(logs)
      }

      setLoading(false)
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId])

  const subAnswerMap = useMemo(() => {
    const m = new Map<string, SubmissionAnswer>()
    for (const a of subAnswers) m.set(a.question_id, a)
    return m
  }, [subAnswers])

  if (loading) return <div className="p-6 text-gray-600">Đang tải...</div>
  if (error) return <div className="p-6 text-red-600">Lỗi: {error}</div>
  if (!submission) return <div className="p-6 text-gray-600">Không có dữ liệu.</div>

  return (
    <div className="p-6 bg-white text-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)]">Chi tiết bài làm</h1>

          <div className="mt-2 text-sm text-gray-600 space-y-1">
            {/* ✅ THÊM DÒNG NÀY */}
            <div>
              Thí sinh:{' '}
              <span className="font-semibold text-gray-900">
                {submission.candidate_name?.trim() || '(Chưa có tên)'}
              </span>
            </div>

            <div>
              Kết quả:{' '}
              <span className={`font-semibold ${submission.passed ? 'text-green-700' : 'text-red-700'}`}>
                {submission.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
              </span>
            </div>

            <div>
              Điểm:{' '}
              <span className="font-semibold">
                {submission.score_percent}%
              </span>{' '}
              ({submission.correct_count}/{submission.total_count})
            </div>

            <div>
              Thời gian làm: {formatDuration(submission.duration_seconds)}
            </div>

            <div>
              Số vi phạm:
              <span className={`font-semibold ml-1 ${submission.violation_count > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {submission.violation_count ?? 0}
              </span>
            </div>
          </div>
        </div>


        <button
          onClick={() => router.push('/reports')}
          className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
        >
          ← Quay lại
        </button>
      </div>

      {/* ✅ Lịch sử Vi phạm */}
      {violationLogs.length > 0 && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/30 p-5">
          <h2 className="text-lg font-bold text-red-700 mb-3">
            ⚠️ Lịch sử Vi phạm ({violationLogs.length})
          </h2>
          <div className="space-y-2">
            {violationLogs.map((log, idx) => (
              <div
                key={log.id}
                className="rounded-lg border border-red-200 bg-white p-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold text-red-700">
                    #{idx + 1}: {log.violation_reason}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Thời gian: {formatDateTime(log.violated_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="mt-6 space-y-5">
        {questions.map((q, idx) => {
          const sa = subAnswerMap.get(q.id)
          const selectedIds = sa?.selected_answer_ids ?? []
          const correctIds = q.answers?.filter(a => a.is_correct).map(a => a.id) ?? []
          const isEssay = q.type === 'essay'

          return (
            <div key={q.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold">
                  Câu {idx + 1}:{' '}
                  <span className="font-normal text-gray-800">{q.content}</span>
                </div>

                {!isEssay && (
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full border ${sa?.is_correct
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-red-300 bg-red-50 text-red-700'
                      }`}
                  >
                    {sa?.is_correct ? 'Đúng' : 'Sai'}
                  </span>
                )}

                {isEssay && (
                  <span className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                    Tự luận
                  </span>
                )}
              </div>

              {/* MCQ */}
              {!isEssay && (
                <div className="space-y-2">
                  {q.answers.map(a => {
                    const isCorrect = correctIds.includes(a.id)
                    const isSelected = selectedIds.includes(a.id)

                    // ✅ Rule:
                    // - Đáp án đúng: xanh
                    // - Chọn sai: đỏ
                    // - Còn lại: xám
                    const cls = isCorrect
                      ? 'border-green-300 bg-green-50'
                      : isSelected
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 bg-white'

                    return (
                      <div key={a.id} className={`rounded-lg border p-3 flex items-center justify-between ${cls}`}>
                        <div className="text-sm text-gray-900">{a.content}</div>

                        <div className="flex gap-2">
                          {isCorrect && (
                            <span className="text-xs px-2 py-1 rounded-full border border-green-300 bg-white text-green-700">
                              Đáp án đúng
                            </span>
                          )}

                          {isSelected && (
                            <span
                              className={`text-xs px-2 py-1 rounded-full border bg-white ${isCorrect ? 'border-green-300 text-green-700' : 'border-red-300 text-red-700'
                                }`}
                            >
                              Bạn chọn
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {q.answers.length === 0 && (
                    <div className="text-sm text-gray-500 italic">(Không load được đáp án)</div>
                  )}
                </div>
              )}

              {/* Essay */}
              {isEssay && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Bài làm:</div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 whitespace-pre-wrap text-sm text-gray-900">
                    {sa?.essay_text?.trim() ? sa.essay_text : <span className="text-gray-400">(Không có nội dung)</span>}
                  </div>

                  <div className="text-xs text-gray-500">
                    Trạng thái chấm: {sa?.is_correct === true ? 'Đúng' : sa?.is_correct === false ? 'Sai' : 'Chưa chấm'}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
