'use client'

import { useEffect, useState, type ClipboardEvent } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'


type QuestionType = 'single' | 'multiple' | 'essay'

type AnswerOption = {
  id: string
  dbId?: string
  text: string
  isCorrect: boolean
  image_url?: string | null // ✅ NEW
}

type Question = {
  id: string
  content: string
  type: QuestionType
  image_url?: string | null // ✅ NEW
  options: AnswerOption[]
}

type Section = 'info' | 'questions'

const toLetter = (i: number) => String.fromCharCode(65 + i)

// ✅ đổi nếu bucket của mày tên khác
const BUCKET = 'test-assets'

async function uploadImageToStorage(supabase: any, file: File, testId: string) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${testId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl as string
}

function getPastedImageFile(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return null
  const imgItem = Array.from(items).find(it => it.type.startsWith('image/'))
  if (!imgItem) return null
  return imgItem.getAsFile()
}


export default function ManageTestQuestionsPage() {
  const supabase = createClient()

  const params = useParams<{ id: string }>()
  const testId = params?.id

  const [activeSection, setActiveSection] = useState<Section>('questions')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [questions, setQuestions] = useState<Question[]>([])

  useEffect(() => {
    if (!testId) return

    const loadQuestions = async () => {
      setLoading(true)

      const { data: qs, error: qErr } = await supabase
        .from('questions')
        .select('id, content, type, image_url') // ✅ NEW
        .eq('test_id', testId)
        .order('id', { ascending: true })

      if (qErr) {
        console.error(qErr)
        alert(qErr.message)
        setLoading(false)
        return
      }

      const qIds = (qs ?? []).map((q: any) => q.id)

      const rawByQ: Record<string, any[]> = {}

      if (qIds.length) {
        const { data: ans, error: aErr } = await supabase
          .from('answers')
          .select('id, question_id, content, is_correct, image_url') // ✅ NEW
          .in('question_id', qIds)
          .order('id', { ascending: true })

        if (aErr) {
          console.error(aErr)
          alert(aErr.message)
          setLoading(false)
          return
        }

        for (const a of (ans ?? []) as any[]) {
          if (!rawByQ[a.question_id]) rawByQ[a.question_id] = []
          rawByQ[a.question_id].push(a)
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
              image_url: a.image_url ?? null, // ✅ NEW
            }))

        return {
          id: q.id,
          content: q.content ?? '',
          type: q.type as QuestionType,
          image_url: (q as any).image_url ?? null, // ✅ NEW
          options,
        }
      })

      setQuestions(mapped)
      setLoading(false)
    }

    loadQuestions()
  }, [testId])

  const deleteQuestion = async (index: number) => {
    const q = questions[index]
    const isNew = q.id.startsWith('new-')

    if (!isNew) {
      if (!confirm('Bạn có chắc muốn xoá câu hỏi này? Hành động này không thể hoàn tác.')) return
    }

    if (isNew) {
      setQuestions(prev => prev.filter((_, i) => i !== index))
    } else {
      try {
        const { error } = await supabase.from('questions').delete().eq('id', q.id)
        if (error) throw error
        setQuestions(prev => prev.filter((_, i) => i !== index))
      } catch (err: any) {
        alert(err.message || 'Xoá thất bại')
      }
    }
  }

  const saveAll = async () => {
    if (!testId) {
      alert('Thiếu testId')
      return
    }
    if (questions.length === 0) {
      alert('Chưa có câu hỏi')
      return
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.content?.trim()) {
        alert(`Câu ${i + 1}: chưa nhập nội dung`)
        return
      }
      if (q.type !== 'essay') {
        if (q.options.length < 2) {
          alert(`Câu ${i + 1}: cần ít nhất 2 đáp án`)
          return
        }
        if (q.type === 'single' && !q.options.some(o => o.isCorrect)) {
          alert(`Câu ${i + 1}: chọn 1 đáp án đúng`)
          return
        }
      }
    }

    setSaving(true)

    try {
      const copy = [...questions]

      for (let i = 0; i < copy.length; i++) {
        const q = copy[i]
        const isNew = q.id.startsWith('new-')

        const correctAnswer =
          q.type === 'essay'
            ? ''
            : q.options
              .filter(o => o.isCorrect)
              .map(o => o.id)
              .join(',')

        const questionPayload = {
          test_id: testId,
          content: q.content ?? '',
          type: q.type,
          correct_answer: correctAnswer,
          options: q.type === 'essay' ? [] : q.options.map(o => o.id),
          image_url: q.image_url ?? null, // ✅ NEW
        }

        let questionId = q.id

        if (isNew) {
          const { data: inserted, error } = await supabase
            .from('questions')
            .insert(questionPayload)
            .select('id')
            .single()

          if (error) throw error

          questionId = inserted.id
          copy[i] = { ...q, id: questionId }
        } else {
          const { error } = await supabase
            .from('questions')
            .update({
              content: questionPayload.content,
              type: questionPayload.type,
              correct_answer: questionPayload.correct_answer,
              options: questionPayload.options,
              image_url: questionPayload.image_url, // ✅ NEW
            })
            .eq('id', questionId)

          if (error) throw error
        }

        if (q.type === 'essay') {
          const { error: delErr } = await supabase.from('answers').delete().eq('question_id', questionId)
          if (delErr) throw delErr
          continue
        }

        const { error: delErr } = await supabase.from('answers').delete().eq('question_id', questionId)
        if (delErr) throw delErr

        const answersPayload = q.options.map(o => ({
          question_id: questionId,
          content: o.text ?? '',
          is_correct: !!o.isCorrect,
          image_url: o.image_url ?? null, // ✅ NEW
        }))

        const { error: insErr } = await supabase.from('answers').insert(answersPayload)
        if (insErr) throw insErr
      }

      setQuestions(copy)
      alert('✅ Đã lưu câu hỏi')
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-8 pb-32">
        <h1 className="text-3xl font-bold">Quản lý câu hỏi</h1>

        <div className="flex justify-end">
          <button
            onClick={saveAll}
            disabled={saving || loading}
            className="px-6 py-2 rounded-lg bg-[#ff5200] text-white font-semibold disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>

        {loading ? (
          <div>Đang tải câu hỏi...</div>
        ) : (
          <div className="border border-gray-200 rounded-xl p-8 space-y-8">
            <button
              onClick={() =>
                setQuestions(prev => [
                  ...prev,
                  {
                    id: `new-${Date.now()}`,
                    content: '',
                    type: 'single',
                    image_url: null, // ✅ NEW
                    options: [
                      { id: 'A', text: '', isCorrect: false, image_url: null },
                      { id: 'B', text: '', isCorrect: false, image_url: null },
                    ],
                  },
                ])
              }
              className="px-5 py-2 rounded-lg bg-[#00a0fa] text-white font-semibold"
            >
              + Thêm câu hỏi
            </button>

            {questions.length === 0 ? (
              <div className="text-gray-500">Test này chưa có câu hỏi.</div>
            ) : (
              questions.map((q, qi) => (
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
                              { id: 'A', text: '', isCorrect: false, image_url: null },
                              { id: 'B', text: '', isCorrect: false, image_url: null },
                            ]
                          }
                          setQuestions(copy)
                        }}
                        className="h-10 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                      >
                        <option value="single">1 đáp án</option>
                        <option value="multiple">Nhiều đáp án</option>
                        <option value="essay">Tự luận</option>
                      </select>

                      <button
                        onClick={() => deleteQuestion(qi)}
                        className="px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium transition-colors"
                        title="Xoá câu hỏi"
                      >
                        Xoá
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* ✅ PASTE ẢNH VÀO CÂU HỎI */}
                    <textarea
                      placeholder="Nội dung câu hỏi (có thể paste ảnh)"
                      value={q.content}
                      onChange={e => {
                        const copy = [...questions]
                        copy[qi].content = e.target.value
                        setQuestions(copy)
                      }}
                      onPaste={async e => {
                        if (!testId) return
                        const file = getPastedImageFile(e)
                        if (!file) return
                        e.preventDefault()
                        try {
                          const url = await uploadImageToStorage(supabase, file, testId)
                          const copy = [...questions]
                          copy[qi].image_url = url
                          setQuestions(copy)
                        } catch (err: any) {
                          alert(err?.message ?? 'Upload ảnh thất bại')
                        }
                      }}
                      className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />

                    {q.image_url && (
                      <div className="space-y-2">
                        <img src={q.image_url} alt="question" className="max-h-72 rounded-lg border border-gray-200" />
                        <button
                          type="button"
                          onClick={() => {
                            const copy = [...questions]
                            copy[qi].image_url = null
                            setQuestions(copy)
                          }}
                          className="text-sm text-red-600 underline"
                        >
                          Xoá ảnh câu hỏi
                        </button>
                      </div>
                    )}

                    {q.type !== 'essay' && (
                      <div className="space-y-4">
                        {q.options.map((o, oi) => (
                          <div key={`${q.id}-${o.id}`} className="space-y-2">
                            <div className="flex items-center gap-3">
                              <input
                                type={q.type === 'single' ? 'radio' : 'checkbox'}
                                checked={o.isCorrect}
                                onChange={() => {
                                  const copy = [...questions]
                                  if (q.type === 'single') {
                                    copy[qi].options.forEach(x => (x.isCorrect = false))
                                  }
                                  copy[qi].options[oi].isCorrect = !copy[qi].options[oi].isCorrect
                                  setQuestions(copy)
                                }}
                              />

                              {/* ✅ PASTE ẢNH VÀO ĐÁP ÁN */}
                              <input
                                placeholder={`Đáp án ${o.id} (có thể paste ảnh)`}
                                value={o.text}
                                onChange={e => {
                                  const copy = [...questions]
                                  copy[qi].options[oi].text = e.target.value
                                  setQuestions(copy)
                                }}
                                onPaste={async e => {
                                  if (!testId) return
                                  const file = getPastedImageFile(e)
                                  if (!file) return
                                  e.preventDefault()
                                  try {
                                    const url = await uploadImageToStorage(supabase, file, testId)
                                    const copy = [...questions]
                                    copy[qi].options[oi].image_url = url
                                    setQuestions(copy)
                                  } catch (err: any) {
                                    alert(err?.message ?? 'Upload ảnh thất bại')
                                  }
                                }}
                                className="flex-1 h-10 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                              />
                            </div>

                            {o.image_url && (
                              <div className="pl-8 space-y-2">
                                <img src={o.image_url} alt="answer" className="max-h-48 rounded-lg border border-gray-200" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...questions]
                                    copy[qi].options[oi].image_url = null
                                    setQuestions(copy)
                                  }}
                                  className="text-sm text-red-600 underline"
                                >
                                  Xoá ảnh đáp án {o.id}
                                </button>
                              </div>
                            )}

                            {/* DELETE ANSWER BUTTON */}
                            {q.options.length > 1 && (
                              <div className="pl-8">
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
                                  className="text-sm text-red-500 hover:text-red-700 underline"
                                >
                                  Xoá đáp án này
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* ADD ANSWER BUTTON */}
                        <button
                          type="button"
                          onClick={() => {
                            const copy = [...questions]
                            const nextChar = String.fromCharCode(65 + copy[qi].options.length)
                            copy[qi].options.push({
                              id: nextChar,
                              text: '',
                              isCorrect: false,
                              image_url: null
                            })
                            setQuestions(copy)
                          }}
                          className="text-sm font-medium text-[#ff5200] hover:underline"
                        >
                          + Thêm đáp án
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
