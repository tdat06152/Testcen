'use client'

import { useState, useEffect, type ClipboardEvent } from 'react'
import { createClient } from '@/utils/supabase/client'

// --- Helpers ---
const BUCKET = 'test-assets'

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

async function uploadImageToStorage(supabase: any, file: File, testId: string) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${testId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`

  console.log('Uploading to:', BUCKET, path)

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) {
    console.error('Upload Error Details:', error)
    throw error
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrlData.publicUrl as string
}

function getPastedImageFile(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return null
  const imgItem = Array.from(items).find(it => it.type.startsWith('image/'))
  if (!imgItem) return null
  return imgItem.getAsFile()
}

// --- Types ---
type QuestionType = 'single' | 'multiple' | 'essay'

type AnswerOption = {
  id: string
  text: string
  isCorrect: boolean
  image_url?: string | null
}

type Question = {
  id: string
  content: string
  type: QuestionType
  options: AnswerOption[]
  image_url?: string | null
  bank_question_id?: string | null
}

type Section = 'info' | 'questions'

export default function CreateTestPage() {
  // Use custom UUID generator to ensure it works on all browsers/contexts
  const [testId, setTestId] = useState('')

  useEffect(() => {
    setTestId(uuidv4())
  }, [])
  const [activeSection, setActiveSection] = useState<Section>('info')
  const [saving, setSaving] = useState(false)

  /* ===== QUESTION BANK IMPORT ===== */
  const [isBankModalOpen, setIsBankModalOpen] = useState(false)
  const [bankQuestions, setBankQuestions] = useState<any[]>([])
  const [bankCategories, setBankCategories] = useState<any[]>([])
  const [selectedBankCat, setSelectedBankCat] = useState<string | 'all'>('all')
  const [bankSearch, setBankSearch] = useState('')
  const [loadingBank, setLoadingBank] = useState(false)

  /* ===== SMART BUILD ===== */
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false)
  const [smartConfig, setSmartConfig] = useState({
    easy: 0,
    medium: 0,
    hard: 0,
    categoryId: 'all'
  })

  const [isAiLoading, setIsAiLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from('question_bank_categories').select('*').order('name')
      setBankCategories(data || [])
    }
    fetchCats()
  }, [])

  const openBankModal = async () => {
    setIsBankModalOpen(true)
    setLoadingBank(true)
    const { data: qs } = await supabase.from('question_bank').select('*').order('created_at', { ascending: false })
    const { data: ans } = await supabase.from('question_bank_answers').select('*')

    const mappedQs = (qs || []).map((q: any) => ({
      ...q,
      answers: (ans || []).filter((a: any) => a.question_id === q.id)
    }))
    setBankQuestions(mappedQs)
    setLoadingBank(false)
  }

  const importSelectedQuestions = (selectedQs: any[]) => {
    const newQs: Question[] = selectedQs.map((q, i) => ({
      id: `bank-${Date.now()}-${i}`,
      content: q.content,
      type: q.type as QuestionType,
      image_url: q.images?.[0] || null,
      bank_question_id: q.id,
      options: q.answers.map((a: any, ai: number) => ({
        id: String.fromCharCode(65 + ai),
        text: a.content,
        isCorrect: a.is_correct,
        image_url: a.images?.[0] || null,
      }))
    }))
    setQuestions(prev => [...prev, ...newQs])
    setIsBankModalOpen(false)
  }

  const handleSmartBuild = async () => {
    setIsSmartModalOpen(false)
    setSaving(true)

    const { data: qs } = await supabase.from('question_bank').select('*')
    const { data: ans } = await supabase.from('question_bank_answers').select('*')

    const mappedQs = (qs || []).map((q: any) => ({
      ...q,
      answers: (ans || []).filter((a: any) => a.question_id === q.id)
    }))

    const filtered = mappedQs.filter((q: any) => smartConfig.categoryId === 'all' || q.category_id === smartConfig.categoryId)

    const pick = (diff: string, count: number) => {
      const pool = filtered.filter((q: any) => (q.difficulty || 'Easy') === diff).sort(() => Math.random() - 0.5)
      return pool.slice(0, count)
    }

    const selected = [
      ...pick('Easy', smartConfig.easy),
      ...pick('Medium', smartConfig.medium),
      ...pick('Hard', smartConfig.hard)
    ]

    const newQs: Question[] = selected.map((q: any, i: number) => ({
      id: `smart-${Date.now()}-${i}`,
      content: q.content,
      type: q.type as QuestionType,
      image_url: q.images?.[0] || null,
      bank_question_id: q.id,
      options: q.answers.map((a: any, ai: number) => ({
        id: String.fromCharCode(65 + ai),
        text: a.content,
        isCorrect: a.is_correct,
        image_url: a.images?.[0] || null,
      }))
    }))

    setQuestions(prev => [...prev, ...newQs])
    setSaving(false)
    alert(`✅ Đã bốc ngẫu nhiên ${newQs.length} câu hỏi!`)
  }

  const aiRefineQuestion = async (qi: number) => {
    const q = questions[qi]
    if (!q.content) return
    setIsAiLoading(true)
    try {
      const res = await fetch('/api/ai/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refine-question', currentContent: q.content })
      })
      const data = await res.json()
      if (data.success) {
        const copy = [...questions]
        copy[qi].content = data.refinedText
        setQuestions(copy)
      } else alert("AI Error: " + data.error)
    } catch (e) { alert("Network Error") }
    finally { setIsAiLoading(false) }
  }

  const aiGenerateDistractors = async (qi: number) => {
    const q = questions[qi]
    if (!q.content) return alert("Hãy nhập nội dung câu hỏi trước")
    const correctAns = q.options.find(o => o.isCorrect)?.text
    if (!correctAns) return alert("Hãy nhập và chọn 1 đáp án đúng trước để AI có cơ sở gợi ý")

    setIsAiLoading(qi === -1 ? false : true) // qi === -1 is just a trick to avoid TS warning if needed, but not needed here
    setIsAiLoading(true)
    try {
      const res = await fetch('/api/ai/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-distractors', question: q.content, correctAnswer: correctAns })
      })
      const data = await res.json()
      if (data.success && data.distractors) {
        const copy = [...questions]
        const currentCorrect = copy[qi].options.filter(o => o.isCorrect)
        const newOptions = [
          ...currentCorrect,
          ...data.distractors.map((text: string, i: number) => ({
            id: String.fromCharCode(65 + currentCorrect.length + i),
            text,
            isCorrect: false,
            image_url: null
          }))
        ]
        // Re-index all IDs to be safe
        newOptions.forEach((o, idx) => o.id = String.fromCharCode(65 + idx))
        copy[qi].options = newOptions
        setQuestions(copy)
      } else alert("AI Error: " + data.error)
    } catch (e) { alert("Network Error") }
    finally { setIsAiLoading(false) }
  }

  /* ===== SECTION 1 ===== */
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

  /* ===== SECTION 2 ===== */
  const [questions, setQuestions] = useState<Question[]>([])

  /* ===== SAVE ===== */
  const saveTest = async () => {
    if (!form.name.trim()) {
      alert('Chưa nhập tên bài kiểm tra')
      return
    }
    if (questions.length === 0) {
      alert('Chưa có câu hỏi')
      return
    }

    setSaving(true)

    // 🔍 DEBUG AUTH: Check if user is actually logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      alert('⚠️ Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
      setSaving(false)
      return
    }
    console.log('✅ Current User ID:', user.id)

    // IMPORTANT: schema của bạn là `title`, `duration_minutes`, `time_limit`
    const insertTestPayload = {
      id: testId, // ✅ Use generated ID
      title: form.name.trim(),
      description: form.description?.trim() || null,
      pass_score: Number(form.passScore),
      time_limit: form.unlimitedTime ? 0 : 1,
      duration_minutes: form.unlimitedTime ? 0 : Number(form.timeMinutes),
      valid_from: form.validFrom || null,
      valid_to: form.validTo || null,
      success_message: form.successMessage?.trim() || null,
      fail_message: form.failMessage?.trim() || null,
      allow_review: !!form.allowReview,
      max_violations: Number(form.maxViolations),
    }

    const { data: test, error: testError } = await supabase
      .from('tests')
      .insert(insertTestPayload)
      .select()
      .single()

    if (testError) {
      alert(testError.message)
      setSaving(false)
      return
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      const correctAnswer =
        q.type === 'essay'
          ? ''
          : (q.options.find(o => o.isCorrect)?.id ?? '')

      const { data: question, error: qError } = await supabase
        .from('questions')
        .insert({
          test_id: test.id,
          content: q.content,
          type: q.type,
          correct_answer: correctAnswer,
          options: q.type === 'essay' ? [] : q.options.map(o => o.id),
          image_url: q.image_url ?? null,
          bank_question_id: q.bank_question_id || null, // ✅ Save link to bank
        })
        .select()
        .single()

      if (qError) {
        console.error('❌ Error inserting question:', qError)
        alert(`Lỗi lưu câu hỏi số ${i + 1}: ${qError.message}\n(Code: ${qError.code}, Details: ${qError.details})`)
        setSaving(false)
        return
      }

      if (q.type !== 'essay') {
        const payload = q.options.map(o => ({
          question_id: question.id,
          content: o.text,
          is_correct: o.isCorrect,
          image_url: o.image_url ?? null, // ✅ Save image
        }))

        const { error: aError } = await supabase.from('answers').insert(payload)

        if (aError) {
          console.error('❌ Error inserting answers:', aError)
          alert(`Lỗi lưu đáp án cho câu ${i + 1}: ${aError.message}`)
          setSaving(false)
          return
        }
      }
    }

    setSaving(false)
    alert('✅ Đã lưu bài kiểm tra thành công!')
  }

  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-8 pb-32">
        <h1 className="text-3xl font-bold">Tạo mới bài kiểm tra</h1>

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

        {/* ================= SECTION 1 ================= */}
        {activeSection === 'info' && (
          <div className="border border-gray-200 rounded-xl p-8 space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <Field label="Tên bài kiểm tra">
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </Field>

              <Field label="Điểm đạt (%)">
                <input
                  type="number"
                  value={form.passScore}
                  onChange={e =>
                    setForm({ ...form, passScore: Number(e.target.value) })
                  }
                  className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                className="w-full min-h-[110px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                    className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                  className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </Field>

              <Field label="Đến">
                <input
                  type="datetime-local"
                  value={form.validTo}
                  onChange={e => setForm({ ...form, validTo: e.target.value })}
                  className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                  className="w-full min-h-[90px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </Field>

              <Field label="Thông báo khi chưa đạt">
                <textarea
                  value={form.failMessage}
                  onChange={e =>
                    setForm({ ...form, failMessage: e.target.value })
                  }
                  className="w-full min-h-[90px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </Field>
            </div>
          </div>
        )}

        {/* ================= SECTION 2 ================= */}
        {activeSection === 'questions' && (
          <div className="border border-gray-200 rounded-xl p-8 space-y-8">


            {questions.map((q, qi) => (
              <div key={q.id} className="border border-gray-200 rounded-xl">
                <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-b">
                  <div className="font-semibold">Câu {qi + 1}</div>

                  <select
                    value={q.type}
                    onChange={e => {
                      const copy = [...questions]
                      copy[qi].type = e.target.value as QuestionType
                      setQuestions(copy)
                    }}
                    className="h-10 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                  >
                    <option value="single">1 đáp án</option>
                    <option value="multiple">Nhiều đáp án</option>
                    <option value="essay">Tự luận</option>
                  </select>

                  <button
                    onClick={() => {
                      const copy = [...questions]
                      copy.splice(qi, 1)
                      setQuestions(copy)
                    }}
                    className="ml-3 text-red-500 hover:text-red-700 font-medium"
                    title="Xóa câu hỏi này"
                  >
                    Xóa
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <textarea
                    placeholder="Nội dung câu hỏi (có thể paste ảnh)"
                    value={q.content}
                    onChange={e => {
                      const copy = [...questions]
                      copy[qi].content = e.target.value
                      setQuestions(copy)
                    }}
                    onPaste={async e => {
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
                    className="w-full h-32 px-5 py-4 bg-white border-2 border-slate-100 rounded-[24px] font-bold focus:border-[#00a0fa] outline-none transition-all resize-none text-lg"
                  />
                  <div className="flex justify-end mt-1">
                    <button
                      onClick={() => aiRefineQuestion(qi)}
                      disabled={isAiLoading}
                      className="text-[10px] font-black text-purple-600 hover:bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      {isAiLoading ? '⌛' : '🪄'} TỐI ƯU CÂU HỎI (AI)
                    </button>
                  </div>

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
                        <div key={o.id} className="space-y-2">
                          <div className="flex items-center gap-3">
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
                            />

                            <input
                              placeholder={`Đáp án ${o.id} (có thể paste ảnh)`}
                              value={o.text}
                              onChange={e => {
                                const copy = [...questions]
                                copy[qi].options[oi].text = e.target.value
                                setQuestions(copy)
                              }}
                              onPaste={async e => {
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
                                className="text-red-500 text-sm font-medium hover:text-red-700 hover:underline"
                              >
                                Xóa
                              </button>
                            )}
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
                                Xoá ảnh đáp án
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="flex gap-4">
                        <button
                          onClick={() => {
                            const copy = [...questions]
                            copy[qi].options.push({
                              id: String.fromCharCode(65 + q.options.length),
                              text: '',
                              isCorrect: false,
                              image_url: null,
                            })
                            setQuestions(copy)
                          }}
                          className="text-[#00a0fa] text-sm font-bold hover:underline"
                        >
                          + Thêm đáp án
                        </button>
                        <button
                          onClick={() => aiGenerateDistractors(qi)}
                          disabled={isAiLoading}
                          className="text-purple-600 text-[10px] font-black hover:underline flex items-center gap-1 disabled:opacity-50"
                        >
                          {isAiLoading ? '⌛' : '🪄'} AI GỢI Ý ĐÁP ÁN NHIỄU
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== FIXED SAVE BAR ===== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4 flex justify-end gap-4 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
        {activeSection === 'questions' && (
          <>
            <button
              onClick={openBankModal}
              className="px-6 py-3 rounded-xl bg-purple-600 text-white font-bold text-lg active:scale-95 transition-transform flex items-center gap-2"
            >
              <span>📂</span> Ngân hàng
            </button>
            <button
              onClick={() => setIsSmartModalOpen(true)}
              className="px-6 py-3 rounded-xl bg-green-600 text-white font-bold text-lg active:scale-95 transition-transform flex items-center gap-2"
            >
              <span>🧠</span> Smart Build
            </button>
            <button
              onClick={() =>
                setQuestions(prev => [
                  ...prev,
                  {
                    id: Date.now().toString(),
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
              className="px-6 py-3 rounded-xl bg-[#00a0fa] text-white font-bold text-lg active:scale-95 transition-transform"
            >
              + Thêm câu hỏi
            </button>
          </>
        )}
        <button
          onClick={saveTest}
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-[#ff5200] text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform"
        >
          {saving ? 'Đang lưu...' : 'Lưu bài kiểm tra'}
        </button>
        {/* ===== BANK MODAL ===== */}
        {isBankModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Ngân hàng câu hỏi</h2>
                  <p className="text-sm text-slate-500 font-medium">Chọn câu hỏi để thêm vào bài thi</p>
                </div>
                <button onClick={() => setIsBankModalOpen(false)} className="text-slate-400 hover:text-slate-900 text-2xl">✕</button>
              </div>

              <div className="p-6 border-b border-slate-100 bg-white flex gap-4">
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                  <input
                    type="text"
                    placeholder="Tìm kiếm câu hỏi..."
                    value={bankSearch}
                    onChange={e => setBankSearch(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold focus:border-purple-500 outline-none transition-all"
                  />
                </div>
                <select
                  value={selectedBankCat}
                  onChange={e => setSelectedBankCat(e.target.value)}
                  className="h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold focus:border-purple-500 outline-none"
                >
                  <option value="all">Tất cả nhóm</option>
                  {bankCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                {loadingBank ? (
                  <div className="text-center py-20 font-bold text-slate-400 animate-pulse">ĐANG TẢI DỮ LIỆU...</div>
                ) : (
                  bankQuestions
                    .filter(q => selectedBankCat === 'all' || q.category_id === selectedBankCat)
                    .filter(q => q.content.toLowerCase().includes(bankSearch.toLowerCase()))
                    .map(q => (
                      <div
                        key={q.id}
                        onClick={() => {
                          importSelectedQuestions([q]);
                        }}
                        className="bg-white border-2 border-slate-100 hover:border-purple-500 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md group"
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span>{q.type === 'essay' ? 'Tự luận' : 'Trắc nghiệm'}</span>
                              <span>•</span>
                              <span>{bankCategories.find(c => c.id === q.category_id)?.name || 'Mặc định'}</span>
                            </div>
                            <div className="font-bold text-slate-800 line-clamp-2">{q.content}</div>
                            <div className="text-xs text-slate-500">{q.answers.length} đáp án</div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 bg-purple-100 text-purple-600 px-3 py-1 rounded-lg text-xs font-black transition-opacity">
                            CHỌN CÂU NÀY
                          </div>
                        </div>
                      </div>
                    ))
                )}
                {bankQuestions.length === 0 && !loadingBank && (
                  <div className="text-center py-20 text-slate-400 font-medium">Không tìm thấy câu hỏi nào trong ngân hàng.</div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-white flex justify-end">
                <button onClick={() => setIsBankModalOpen(false)} className="px-8 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all">ĐÓNG</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== SMART BUILD MODAL ===== */}
        {isSmartModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-8 space-y-8 border border-white/20">
              <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">🧠 Smart Build</h2>
                <p className="text-sm text-slate-500 font-medium">Hệ thống sẽ bốc ngẫu nhiên câu hỏi theo yêu cầu của bạn.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Nhóm câu hỏi</label>
                  <select
                    value={smartConfig.categoryId}
                    onChange={e => setSmartConfig({ ...smartConfig, categoryId: e.target.value })}
                    className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-green-500 outline-none transition-all"
                  >
                    <option value="all">Tất cả nhóm</option>
                    {bankCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-green-600 tracking-widest ml-1">Dễ</label>
                    <input
                      type="number"
                      min="0"
                      value={smartConfig.easy}
                      onChange={e => setSmartConfig({ ...smartConfig, easy: Number(e.target.value) })}
                      className="w-full h-14 px-4 bg-green-50 border-2 border-green-100 rounded-2xl font-black text-center focus:border-green-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-orange-600 tracking-widest ml-1">T.Bình</label>
                    <input
                      type="number"
                      min="0"
                      value={smartConfig.medium}
                      onChange={e => setSmartConfig({ ...smartConfig, medium: Number(e.target.value) })}
                      className="w-full h-14 px-4 bg-orange-50 border-2 border-orange-100 rounded-2xl font-black text-center focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-red-600 tracking-widest ml-1">Khó</label>
                    <input
                      type="number"
                      min="0"
                      value={smartConfig.hard}
                      onChange={e => setSmartConfig({ ...smartConfig, hard: Number(e.target.value) })}
                      className="w-full h-14 px-4 bg-red-50 border-2 border-red-100 rounded-2xl font-black text-center focus:border-red-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setIsSmartModalOpen(false)} className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">HỦY</button>
                <button
                  onClick={handleSmartBuild}
                  className="px-8 py-3 rounded-2xl bg-black text-white font-black hover:bg-slate-800 transition-all shadow-xl active:scale-95 uppercase tracking-tight"
                >
                  Bốc câu hỏi ngay
                </button>
              </div>
            </div>
          </div>
        )}
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
