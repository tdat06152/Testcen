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

  // Bank state
  const [showBankModal, setShowBankModal] = useState(false)
  const [bankQuestions, setBankQuestions] = useState<any[]>([])
  const [bankCategories, setBankCategories] = useState<any[]>([])
  const [loadingBank, setLoadingBank] = useState(false)
  const [selectedBankCat, setSelectedBankCat] = useState<string | 'all'>('all')

  const openBank = async () => {
    setShowBankModal(true)
    setLoadingBank(true)
    const { data: cats } = await supabase.from('question_bank_categories').select('*').order('name')
    const { data: qs } = await supabase.from('question_bank').select('*, question_bank_answers(*)').order('created_at', { ascending: false })
    setBankCategories(cats || [])
    setBankQuestions(qs || [])
    setLoadingBank(false)
  }

  const importQuestion = (bq: any) => {
    const newQ: Question = {
      id: `new-${Date.now()}-${Math.random()}`,
      content: bq.content,
      type: bq.type,
      image_url: bq.images?.[0] || null,
      options: bq.type === 'essay' ? [] : (bq.question_bank_answers || []).map((ba: any, idx: number) => ({
        id: toLetter(idx),
        text: ba.content || '',
        isCorrect: !!ba.is_correct,
        image_url: ba.images?.[0] || null
      }))
    }
    setQuestions(prev => [...prev, newQ])
  }

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



        {loading ? (
          <div>Đang tải câu hỏi...</div>
        ) : (
          <div className="border border-gray-200 rounded-xl p-8 space-y-8">


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

      {/* ===== FIXED SAVE BAR ===== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4 flex justify-end gap-4">
        <button
          onClick={openBank}
          disabled={loading || saving}
          className="px-6 py-3 rounded-xl bg-slate-800 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
          Lấy từ ngân hàng
        </button>
        <button
          onClick={() =>
            setQuestions(prev => [
              ...prev,
              {
                id: `new-${Date.now()}`,
                content: '',
                type: 'single',
                image_url: null,
                options: [
                  { id: 'A', text: '', isCorrect: false, image_url: null },
                  { id: 'B', text: '', isCorrect: false, image_url: null },
                ],
              },
            ])
          }
          disabled={loading || saving}
          className="px-6 py-3 rounded-xl bg-[#00a0fa] text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform"
        >
          + Thêm câu hỏi
        </button>
        <button
          onClick={saveAll}
          disabled={saving || loading}
          className="px-8 py-3 rounded-xl bg-[#ff5200] text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform"
        >
          {saving ? 'Đang lưu...' : 'Lưu câu hỏi'}
        </button>
      </div>

      {/* ✅ BANK MODAL */}
      {showBankModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Ngân hàng câu hỏi</h2>
              <button
                onClick={() => setShowBankModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-200 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* Sidebar Cats */}
              <div className="w-64 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
                <button
                  onClick={() => setSelectedBankCat('all')}
                  className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedBankCat === 'all' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Tất cả câu hỏi
                </button>
                {bankCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedBankCat(cat.id)}
                    className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedBankCat === cat.id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Bank Questions */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingBank ? (
                  <div className="text-center py-12 text-slate-400 font-medium">Đang tải câu hỏi...</div>
                ) : bankQuestions.filter(bq => selectedBankCat === 'all' || bq.category_id === selectedBankCat).length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-medium italic">Không có câu hỏi nào trong nhóm này.</div>
                ) : (
                  bankQuestions.filter(bq => selectedBankCat === 'all' || bq.category_id === selectedBankCat).map(bq => {
                    // Check if already in test
                    const alreadyIn = questions.some(q => q.content === bq.content)
                    return (
                      <div key={bq.id} className="border border-slate-200 rounded-2xl p-4 flex justify-between items-start gap-4 hover:border-blue-200 transition-colors">
                        <div className="flex-1 space-y-2">
                          <div className={`text-[10px] font-bold uppercase tracking-wider inline-block px-2 py-0.5 rounded ${bq.type === 'essay' ? 'bg-purple-100 text-purple-600' :
                            bq.type === 'multiple' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                            }`}>
                            {bq.type === 'essay' ? 'Tự luận' : bq.type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án'}
                          </div>
                          <div className="text-slate-800 font-medium line-clamp-2">{bq.content}</div>
                        </div>
                        <button
                          onClick={() => {
                            importQuestion(bq)
                            alert('Đã thêm vào đề thi!')
                          }}
                          disabled={alreadyIn}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${alreadyIn ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg shadow-blue-100 hover:brightness-110 active:scale-95'
                            }`}
                        >
                          {alreadyIn ? 'Đã có' : '+ Thêm'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setShowBankModal(false)}
                className="px-6 py-2 rounded-xl bg-slate-800 text-white font-bold"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
