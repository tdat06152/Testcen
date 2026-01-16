'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type QuestionType = 'single' | 'multiple' | 'essay'

type AnswerOption = {
  id: string
  text: string
  isCorrect: boolean
}

type Question = {
  id: string
  content: string
  type: QuestionType
  options: AnswerOption[]
}

type Section = 'info' | 'questions'

export default function CreateTestPage() {
  const [activeSection, setActiveSection] = useState<Section>('info')
  const [saving, setSaving] = useState(false)

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

    // IMPORTANT: schema của bạn là `title`, `duration_minutes`, `time_limit`
    const insertTestPayload = {
      title: form.name.trim(), // ✅ name -> title
      description: form.description?.trim() || null,
      pass_score: Number(form.passScore),

      // ✅ time_limit = true nghĩa là CÓ giới hạn thời gian
      // unlimitedTime = true nghĩa là KHÔNG giới hạn -> đảo lại
      time_limit: form.unlimitedTime ? 0 : 1,

      // ✅ integer hoặc null (tuyệt đối không boolean)
      duration_minutes: form.unlimitedTime ? 0 : Number(form.timeMinutes),

      valid_from: form.validFrom || null,
      valid_to: form.validTo || null,
      success_message: form.successMessage?.trim() || null,
      fail_message: form.failMessage?.trim() || null,
      allow_review: !!form.allowReview,
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

      // xác định đáp án đúng (để thỏa NOT NULL correct_answer)
      const correctAnswer =
        q.type === 'essay'
          ? '' // tự luận không có đáp án
          : (q.options.find(o => o.isCorrect)?.id ?? '')

      const { data: question, error: qError } = await supabase
        .from('questions')
        .insert({
          test_id: test.id,
          content: q.content,
          type: q.type,

          // 👇 BẮT BUỘC vì DB đang NOT NULL
          correct_answer: correctAnswer,

          // 👇 nếu DB còn cột options NOT NULL
          options: q.type === 'essay' ? [] : q.options.map(o => o.id),
        })
        .select()
        .single()



      if (qError) {
        alert(qError.message)
        setSaving(false)
        return
      }

      if (q.type !== 'essay') {
        const payload = q.options.map(o => ({
          question_id: question.id,
          content: o.text,
          is_correct: o.isCorrect,
        }))

        const { error: aError } = await supabase.from('answers').insert(payload)

        if (aError) {
          alert(aError.message)
          setSaving(false)
          return
        }
      }
    }

    setSaving(false)
    alert('✅ Đã lưu bài kiểm tra')
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
            <button
              onClick={() =>
                setQuestions(prev => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    content: '',
                    type: 'single',
                    options: [
                      { id: 'A', text: '', isCorrect: false },
                      { id: 'B', text: '', isCorrect: false },
                    ],
                  },
                ])
              }
              className="px-5 py-2 rounded-lg bg-[#00a0fa] text-white font-semibold"
            >
              + Thêm câu hỏi
            </button>

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
                    placeholder="Nội dung câu hỏi"
                    value={q.content}
                    onChange={e => {
                      const copy = [...questions]
                      copy[qi].content = e.target.value
                      setQuestions(copy)
                    }}
                    className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />

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
                          />

                          <input
                            placeholder={`Đáp án ${o.id}`}
                            value={o.text}
                            onChange={e => {
                              const copy = [...questions]
                              copy[qi].options[oi].text = e.target.value
                              setQuestions(copy)
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
                      ))}

                      <button
                        onClick={() => {
                          const copy = [...questions]
                          const nextChar = String.fromCharCode(65 + copy[qi].options.length)
                          copy[qi].options.push({
                            id: nextChar,
                            text: '',
                            isCorrect: false,
                          })
                          setQuestions(copy)
                        }}
                        className="text-sm font-medium text-[#ff5200]"
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
          onClick={saveTest}
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-[#ff5200] text-white font-bold text-lg disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : 'Lưu bài kiểm tra'}
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
