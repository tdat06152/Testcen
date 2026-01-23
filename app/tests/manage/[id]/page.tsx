'use client'

import { useEffect, useState, type ClipboardEvent } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import * as XLSX from 'xlsx'

type QuestionType = 'single' | 'multiple' | 'essay'

type AnswerOption = {
  id: string
  dbId?: string
  text: string
  isCorrect: boolean
  images: string[] // Changed from image_url
}

type Question = {
  id: string
  content: string
  type: QuestionType
  images: string[] // Changed from image_url
  options: AnswerOption[]
}

type Section = 'info' | 'questions'

/* Helpers for Date */
function toDatetimeLocal(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/* Helpers for Images */
const BUCKET = 'question-images'

async function uploadImageToStorage(supabase: any, file: File, testId: string) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${testId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl as string
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

function getPastedImageFile(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return null
  const imgItem = Array.from(items).find(it => it.type.startsWith('image/'))
  if (!imgItem) return null
  return imgItem.getAsFile()
}

const toLetter = (i: number) => String.fromCharCode(65 + i)

export default function ManageTestPage() {
  const supabase = createClient()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const testId = params?.id

  const initialTab = searchParams.get('tab') === 'questions' ? 'questions' : 'info'
  const [activeSection, setActiveSection] = useState<Section>(initialTab)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'draft' | 'published'>('draft')
  const [toggling, setToggling] = useState(false)

  // Export State
  const [exportModal, setExportModal] = useState<{ id: string; title: string } | null>(null)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [exporting, setExporting] = useState(false)

  /* ===== DATA STATE ===== */
  const [form, setForm] = useState({
    name: '',
    description: '',
    passScore: 80,
    unlimitedTime: true,
    timeMinutes: 60,
    validFrom: '',
    validTo: '',
    successMessage: '',
    failMessage: '',
    allowReview: true,
    maxViolations: 0,
  })

  const [questions, setQuestions] = useState<Question[]>([])

  /* ===== LOAD ===== */
  useEffect(() => {
    if (!testId) return

    const load = async () => {
      setLoading(true)

      // 1. Load Test Info
      const { data: t, error: tErr } = await supabase
        .from('tests')
        .select('*')
        .eq('id', testId)
        .single()

      if (tErr) {
        alert(tErr.message)
        setLoading(false)
        return
      }

      // Save status
      setTestStatus(t.status ?? 'draft')

      // Map Info
      const timeLimitOn =
        typeof t.time_limit === 'boolean'
          ? t.time_limit
          : Number(t.time_limit ?? 0) === 1
      const unlimited = !timeLimitOn
      const duration = Number(t.duration_minutes ?? 0)

      setForm({
        name: t.title ?? '',
        description: t.description ?? '',
        passScore: Number(t.pass_score ?? 80),
        unlimitedTime: unlimited,
        timeMinutes: unlimited ? 60 : duration || 60,
        validFrom: toDatetimeLocal(t.valid_from),
        validTo: toDatetimeLocal(t.valid_to),
        successMessage: t.success_message ?? '',
        failMessage: t.fail_message ?? '',
        allowReview: !!t.allow_review,
        maxViolations: Number(t.max_violations ?? 0),
      })

      // 2. Load Questions
      const { data: qs, error: qErr } = await supabase
        .from('questions')
        .select('id, content, type, image_url')
        .eq('test_id', testId)
        .order('id', { ascending: true })

      if (qErr) {
        alert(qErr.message)
      } else {
        const qIds = (qs ?? []).map((q: any) => q.id)
        const rawByQ: Record<string, any[]> = {}

        if (qIds.length) {
          const { data: ans, error: aErr } = await supabase
            .from('answers')
            .select('id, question_id, content, is_correct, image_url')
            .in('question_id', qIds)
            .order('id', { ascending: true })

          if (aErr) alert(aErr.message)
          else {
            for (const a of ans ?? []) {
              if (!rawByQ[a.question_id]) rawByQ[a.question_id] = []
              rawByQ[a.question_id].push(a)
            }
          }
        }

        const mapped: Question[] = (qs ?? []).map((q: any) => {
          const rawAnswers = rawByQ[q.id] ?? []
          const options: AnswerOption[] =
            q.type === 'essay'
              ? []
              : rawAnswers.map((a, idx) => ({
                id: toLetter(idx),
                dbId: a.id,
                text: a.content ?? '',
                isCorrect: !!a.is_correct,
                images: parseImages(a.image_url),
              }))

          // Fix empty options if non-essay
          if (q.type !== 'essay' && options.length === 0) {
            options.push(
              { id: 'A', text: '', isCorrect: false, images: [] },
              { id: 'B', text: '', isCorrect: false, images: [] }
            )
          }

          return {
            id: q.id,
            content: q.content ?? '',
            type: q.type as QuestionType,
            images: parseImages(q.image_url),
            options,
          }
        })
        setQuestions(mapped)
      }

      setLoading(false)
    }

    load()
  }, [testId])

  /* ===== TOGGLE PUBLISH ===== */
  const togglePublish = async () => {
    if (!testId) return
    const nextStatus = testStatus === 'published' ? 'draft' : 'published'
    setToggling(true)
    try {
      const { error } = await supabase
        .from('tests')
        .update({ status: nextStatus })
        .eq('id', testId)
      if (error) throw error
      setTestStatus(nextStatus)
      alert(nextStatus === 'published' ? '✅ Đã xuất bản!' : '✅ Đã chuyển về nháp!')
    } catch (err: any) {
      alert(err.message || 'Lỗi')
    } finally {
      setToggling(false)
    }
  }


  /* ===== EXPORT ===== */
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

  /* ===== SAVE ALL ===== */
  const saveAll = async () => {
    if (!testId) return

    // Check if published
    if (testStatus === 'published') {
      return alert('⚠️ Không thể chỉnh sửa bài test đang xuất bản. Vui lòng ngừng xuất bản trước!')
    }

    // Validate Info
    if (!form.name.trim()) return alert('Chưa nhập tên bài kiểm tra')

    // Validate Questions
    if (questions.length === 0) return alert('Chưa có câu hỏi')
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.content?.trim() && q.images.length === 0) {
        return alert(`Câu ${i + 1}: chưa nhập nội dung hoặc hình ảnh`)
      }
      if (q.type !== 'essay') {
        if (q.options.length < 2) return alert(`Câu ${i + 1}: cần ít nhất 2 đáp án`)
        if (q.type === 'single' && !q.options.some(o => o.isCorrect)) {
          return alert(`Câu ${i + 1}: chọn 1 đáp án đúng`)
        }
      }
    }

    setSaving(true)

    try {
      // 1. Update Info
      const infoPayload = {
        title: form.name.trim(),
        description: form.description?.trim() || null,
        pass_score: Number(form.passScore),
        time_limit: form.unlimitedTime ? 0 : 1,
        duration_minutes: form.unlimitedTime ? 0 : Number(form.timeMinutes),
        valid_from: form.validFrom ? fromDatetimeLocal(form.validFrom) : null,
        valid_to: form.validTo ? fromDatetimeLocal(form.validTo) : null,
        success_message: form.successMessage?.trim() || null,
        fail_message: form.failMessage?.trim() || null,
        allow_review: !!form.allowReview,
        max_violations: Number(form.maxViolations),
      }

      const { error: infoErr } = await supabase
        .from('tests')
        .update(infoPayload)
        .eq('id', testId)

      if (infoErr) throw infoErr

      // 2. Update Questions (Diffing)
      // Note: We process one by one to keep it simple, though batching is faster.
      const qsCopy = [...questions]
      const currentQIds = []

      for (let i = 0; i < qsCopy.length; i++) {
        const q = qsCopy[i]
        const isNew = q.id.startsWith('new-')

        const correctAnsStr =
          q.type === 'essay'
            ? ''
            : q.options
              .filter(o => o.isCorrect)
              .map(o => o.id) // This is just Letter, not DB ID. Correct logic might need DB ID if required? 
              // Actually, existing code uses `o.id` (A, B...) for `correct_answer` column if it's text based?
              // Wait, let's check `create/page.tsx`:
              // `correct_answer: correctAnswer` where `correctAnswer` is ID (A, B...).
              // So yes, `correct_answer` stores the Letter ID (like 'A'), NOT the UUID.
              .join(',')

        const qPayload = {
          test_id: testId,
          content: q.content ?? '',
          type: q.type,
          correct_answer: correctAnsStr,
          options: q.type === 'essay' ? [] : q.options.map(o => o.id), // A, B, C...
          image_url: q.images.length > 0 ? JSON.stringify(q.images) : null,
        }

        let realQId = q.id

        if (isNew) {
          const { data: insQ, error: insErr } = await supabase
            .from('questions')
            .insert(qPayload)
            .select('id')
            .single()
          if (insErr) throw insErr
          realQId = insQ.id
          qsCopy[i].id = realQId // Update local ID
        } else {
          const { error: updErr } = await supabase
            .from('questions')
            .update({
              content: qPayload.content,
              type: qPayload.type,
              correct_answer: qPayload.correct_answer,
              options: qPayload.options,
              image_url: qPayload.image_url,
            })
            .eq('id', realQId)
          if (updErr) throw updErr
        }
        currentQIds.push(realQId)

        // Handle Answers
        if (q.type === 'essay') {
          // Delete old answers
          await supabase.from('answers').delete().eq('question_id', realQId)
        } else {
          // Delete ALL old answers and re-insert is Easiest way to handle re-ordering and updates safely
          // BUT `answers` table has ID. If we delete, we lose history?
          // If we want to preserve IDs, we need diffing.
          // For simplicity and robustness given previous code style:
          // Existing `questions/page.tsx` DELETED all answers and RE-INSERTED.
          // See lines 250-260 in Step 35.
          await supabase.from('answers').delete().eq('question_id', realQId)

          const ansPayload = q.options.map(o => ({
            question_id: realQId,
            content: o.text ?? '',
            is_correct: !!o.isCorrect,
            image_url: o.images.length > 0 ? JSON.stringify(o.images) : null,
          }))

          if (ansPayload.length > 0) {
            const { error: ansErr } = await supabase.from('answers').insert(ansPayload)
            if (ansErr) throw ansErr
          }
        }
      }

      // Delete removed questions
      // We did not track "deleted" questions explicitly, but we have `currentQIds`.
      // Any question currently in DB for this test that is NOT in `currentQIds` should be deleted.
      // However, `saveAll` in `questions/page.tsx` didn't implement this "Delete Others".
      // It relied on `deleteQuestion` function immediately deleting from DB.
      // Since we want "Create" style where we might delete locally?
      // "Create" doesn't have DB IDs yet.
      // "Manage" usually deletes immediately.
      // If I want "Manage" to be like "Create" (Save at end), I should defer deletions?
      // But standard `deleteQuestion` in `questions/page.tsx` was immediate.
      // I will keep `deleteQuestion` IMMEDIATE for existing Qs to avoid complex state tracking of "deletedIds".
      // This is slightly hybrids, but safe.

      setQuestions(qsCopy)
      alert('✅ Đã lưu thay đổi!')
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  /* ===== DELETE QUESTION ===== */
  const deleteQuestion = async (index: number) => {
    if (testStatus === 'published') {
      return alert('⚠️ Không thể xóa câu hỏi khi bài test đang xuất bản!')
    }

    const q = questions[index]
    const isNew = q.id.startsWith('new-')

    if (!confirm('Bạn có chắc muốn xoá câu hỏi này?')) return

    if (isNew) {
      setQuestions(prev => prev.filter((_, i) => i !== index))
    } else {
      // Delete immediately from DB
      try {
        const { error } = await supabase.from('questions').delete().eq('id', q.id)
        if (error) throw error
        setQuestions(prev => prev.filter((_, i) => i !== index))
      } catch (e: any) {
        alert(e.message)
      }
    }
  }

  if (loading) return <div className="p-8">Đang tải...</div>

  const isPublished = testStatus === 'published'

  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-8 pb-32">
        {/* Header with Title and Publish Toggle */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Quản lý bài kiểm tra</h1>
          <button
            onClick={togglePublish}
            disabled={toggling}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-colors ${isPublished
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-green-500 text-white hover:bg-green-600'
              } disabled:opacity-50`}
          >
            {toggling ? 'Đang...' : isPublished ? '🔒 Ngừng xuất bản' : '✅ Xuất bản'}
          </button>

          {/* Export Button */}
          <button
            onClick={() => {
              if (!testId) return
              const now = new Date()
              now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
              const start = new Date()
              start.setDate(start.getDate() - 30)
              start.setMinutes(start.getMinutes() - start.getTimezoneOffset())

              setExportModal({ id: testId, title: form.name })
              setDateRange({
                from: start.toISOString().slice(0, 16),
                to: now.toISOString().slice(0, 16)
              })
            }}
            className="ml-3 px-6 py-2.5 rounded-lg font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-colors"
          >
            Xuất dữ liệu
          </button>
        </div>

        {/* Warning Banner when Published */}
        {isPublished && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold text-orange-800">
                  🔒 Bài test đang ở trạng thái xuất bản
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  Không thể chỉnh sửa khi đang xuất bản. Nhấn nút "Ngừng xuất bản" ở trên để có thể chỉnh sửa.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="flex gap-8 border-b border-gray-200">
          <button
            onClick={() => setActiveSection('info')}
            className={`pb-3 font-semibold ${activeSection === 'info'
              ? 'border-b-2 border-[#ff5200] text-[#ff5200]'
              : 'text-gray-500'
              }`}
          >
            Thông tin cơ bản
          </button>

          <button
            onClick={() => setActiveSection('questions')}
            className={`pb-3 font-semibold ${activeSection === 'questions'
              ? 'border-b-2 border-[#ff5200] text-[#ff5200]'
              : 'text-gray-500'
              }`}
          >
            Câu hỏi ({questions.length})
          </button>
        </div>

        {/* ================= SECTION 1: INFO ================= */}
        {activeSection === 'info' && (
          <div className="border border-gray-200 rounded-xl p-8 space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <Field label="Tên bài kiểm tra">
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  disabled={isPublished}
                  className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </Field>

              <Field label="Điểm đạt (%)">
                <input
                  type="number"
                  value={form.passScore}
                  onChange={e =>
                    setForm({ ...form, passScore: Number(e.target.value) })
                  }
                  disabled={isPublished}
                  className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </Field>
            </div>

            <Field label="Số lần vi phạm tối đa (0 = không giới hạn)">
              <input
                type="number"
                min="0"
                value={form.maxViolations}
                onChange={e =>
                  setForm({ ...form, maxViolations: Number(e.target.value) })
                }
                disabled={isPublished}
                className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-sm text-gray-500 mt-1">
                Vi phạm bao gồm: chuyển tab, chụp màn hình, thu nhỏ màn hình. Khi vượt quá số lần cho phép, bài làm sẽ bị khóa.
              </p>
            </Field>

            <Field label="Mô tả">
              <textarea
                value={form.description}
                onChange={e =>
                  setForm({ ...form, description: e.target.value })
                }
                disabled={isPublished}
                className="w-full min-h-[110px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </Field>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.unlimitedTime}
                    onChange={e =>
                      setForm({ ...form, unlimitedTime: e.target.checked })
                    }
                    disabled={isPublished}
                  />
                  Không giới hạn thời gian
                </label>

                {!form.unlimitedTime && (
                  <input
                    type="number"
                    placeholder="Thời gian (phút)"
                    value={form.timeMinutes}
                    onChange={e =>
                      setForm({
                        ...form,
                        timeMinutes: Number(e.target.value),
                      })
                    }
                    disabled={isPublished}
                    className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allowReview}
                  onChange={e =>
                    setForm({ ...form, allowReview: e.target.checked })
                  }
                  disabled={isPublished}
                />
                Cho phép xem lại bài làm
              </label>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <Field label="Hiệu lực từ">
                <input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={e => setForm({ ...form, validFrom: e.target.value })}
                  disabled={isPublished}
                  className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </Field>

              <Field label="Đến">
                <input
                  type="datetime-local"
                  value={form.validTo}
                  onChange={e => setForm({ ...form, validTo: e.target.value })}
                  disabled={isPublished}
                  className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <Field label="Thông báo khi đạt">
                <textarea
                  value={form.successMessage}
                  onChange={e =>
                    setForm({ ...form, successMessage: e.target.value })
                  }
                  disabled={isPublished}
                  className="w-full min-h-[90px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </Field>

              <Field label="Thông báo khi chưa đạt">
                <textarea
                  value={form.failMessage}
                  onChange={e =>
                    setForm({ ...form, failMessage: e.target.value })
                  }
                  disabled={isPublished}
                  className="w-full min-h-[90px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </Field>
            </div>
          </div>
        )}

        {/* ================= SECTION 2: QUESTIONS ================= */}
        {activeSection === 'questions' && (
          <div className="border border-gray-200 rounded-xl p-8 space-y-8">
            <button
              onClick={() =>
                setQuestions(prev => [
                  ...prev,
                  {
                    id: `new-${Date.now()}`,
                    content: '',
                    type: 'single',
                    image_url: null,
                    images: [],
                    options: [
                      { id: 'A', text: '', isCorrect: false, images: [] },
                      { id: 'B', text: '', isCorrect: false, images: [] },
                    ],
                  },
                ])
              }
              disabled={isPublished}
              className="px-5 py-2 rounded-lg bg-[#00a0fa] text-white font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              + Thêm câu hỏi
            </button>

            {questions.map((q, qi) => (
              <div key={q.id} className="border border-gray-200 rounded-xl">
                <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-b">
                  <div className="font-semibold">Câu {qi + 1}</div>

                  <div className="flex items-center gap-3">
                    <select
                      value={q.type}
                      onChange={e => {
                        const copy = [...questions]
                        copy[qi].type = e.target.value as QuestionType
                        if (copy[qi].type === 'essay') copy[qi].options = []
                        if (copy[qi].type !== 'essay' && copy[qi].options.length === 0) {
                          copy[qi].options = [
                            { id: 'A', text: '', isCorrect: false, images: [] },
                            { id: 'B', text: '', isCorrect: false, images: [] },
                          ]
                        }
                        setQuestions(copy)
                      }}
                      disabled={isPublished}
                      className="h-10 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      <option value="single">1 đáp án</option>
                      <option value="multiple">Nhiều đáp án</option>
                      <option value="essay">Tự luận</option>
                    </select>

                    <button
                      onClick={() => deleteQuestion(qi)}
                      disabled={isPublished}
                      className="text-red-500 hover:text-red-700 font-medium ml-3 disabled:text-gray-400 disabled:cursor-not-allowed"
                      title="Xóa câu hỏi này"
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* QUESTION CONTENT + IMAGE PASTE */}
                  <div className="space-y-2">
                    <textarea
                      placeholder="Nội dung câu hỏi (Paste ảnh vào đây để upload)"
                      value={q.content}
                      onChange={e => {
                        const copy = [...questions]
                        copy[qi].content = e.target.value
                        setQuestions(copy)
                      }}
                      onPaste={async e => {
                        if (!testId) return
                        if (isPublished) {
                          e.preventDefault()
                          return alert('⚠️ Không thể upload ảnh khi bài test đang xuất bản!')
                        }
                        const file = getPastedImageFile(e)
                        if (!file) return
                        e.preventDefault()
                        try {
                          const url = await uploadImageToStorage(supabase, file, testId)
                          const copy = [...questions]
                          copy[qi].images = [...(copy[qi].images || []), url]
                          setQuestions(copy)
                        } catch (err: any) {
                          alert(err?.message ?? 'Upload ảnh thất bại')
                        }
                      }}
                      disabled={isPublished}
                      className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    {q.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {q.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="relative inline-block">
                            <img src={img} alt="Question" className="max-h-64 rounded border" />
                            <button
                              onClick={() => {
                                const copy = [...questions]
                                copy[qi].images = copy[qi].images.filter((_, i) => i !== imgIdx)
                                setQuestions(copy)
                              }}
                              disabled={isPublished}
                              className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-red-600"
                              title="Xoá ảnh"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {q.type !== 'essay' && (
                    <div className="space-y-4">
                      {q.options.map((o, oi) => (
                        <div key={o.id} className="flex items-center gap-3">
                          <input
                            type={q.type === 'single' ? 'radio' : 'checkbox'}
                            checked={o.isCorrect}
                            onChange={() => {
                              const copy = [...questions]
                              if (q.type === 'single') {
                                copy[qi].options.forEach(x => (x.isCorrect = false))
                              }
                              copy[qi].options[oi].isCorrect = !o.isCorrect
                              setQuestions(copy)
                            }}
                            disabled={isPublished}
                          />

                          <div className="flex-1 space-y-2">
                            <input
                              placeholder={`Đáp án ${o.id} (Paste ảnh vào đây)`}
                              value={o.text}
                              onChange={e => {
                                const copy = [...questions]
                                copy[qi].options[oi].text = e.target.value
                                setQuestions(copy)
                              }}
                              onPaste={async e => {
                                if (!testId) return
                                if (isPublished) {
                                  e.preventDefault()
                                  return alert('⚠️ Không thể upload ảnh khi bài test đang xuất bản!')
                                }
                                const file = getPastedImageFile(e)
                                if (!file) return
                                e.preventDefault()
                                try {
                                  const url = await uploadImageToStorage(supabase, file, testId)
                                  const copy = [...questions]
                                  const opts = copy[qi].options
                                  opts[oi].images = [...(opts[oi].images || []), url]
                                  setQuestions(copy)
                                } catch (err: any) {
                                  alert(err?.message ?? 'Upload ảnh thất bại')
                                }
                              }}
                              disabled={isPublished}
                              className="w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                            {o.images && o.images.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {o.images.map((img, imgIdx) => (
                                  <div key={imgIdx} className="relative inline-block">
                                    <img src={img} alt="Answer" className="max-h-32 rounded border" />
                                    <button
                                      onClick={() => {
                                        const copy = [...questions]
                                        copy[qi].options[oi].images = copy[qi].options[oi].images.filter((_, i) => i !== imgIdx)
                                        setQuestions(copy)
                                      }}
                                      disabled={isPublished}
                                      className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-red-600"
                                      title="Xoá ảnh"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {q.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...questions]
                                copy[qi].options.splice(oi, 1)
                                // Re-index IDs
                                copy[qi].options.forEach((opt, idx) => {
                                  opt.id = String.fromCharCode(65 + idx)
                                })
                                setQuestions(copy)
                              }}
                              disabled={isPublished}
                              className="text-red-500 text-sm font-medium hover:text-red-700 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        onClick={() => {
                          const copy = [...questions]
                          const nextChar = String.fromCharCode(65 + copy[qi].options.length)
                          copy[qi].options.push({
                            id: nextChar,
                            text: '',
                            isCorrect: false,
                            images: []
                          })
                          setQuestions(copy)
                        }}
                        disabled={isPublished}
                        className="text-sm font-medium text-[#ff5200] disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        + Thêm đáp án
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== FIXED SAVE BAR ===== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4 flex justify-end">
        <button
          onClick={saveAll}
          disabled={saving || isPublished}
          className="px-8 py-3 rounded-xl bg-[#ff5200] text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title={isPublished ? 'Ngừng xuất bản trước khi lưu thay đổi' : ''}
        >
          {saving ? 'Đang lưu...' : isPublished ? '🔒 Đã khóa' : 'Lưu thay đổi'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  )
}
