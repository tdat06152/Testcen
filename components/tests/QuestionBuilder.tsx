'use client'

import { useState } from 'react'

export type QuestionType = 'single' | 'multiple' | 'essay'

export interface Answer {
  id: string
  content: string
  is_correct: boolean
}

export interface Question {
  id: string
  content: string
  type: QuestionType
  answers: Answer[]
}

export default function QuestionBuilder({
  questions,
  setQuestions,
}: {
  questions: Question[]
  setQuestions: (q: Question[]) => void
}) {
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: crypto.randomUUID(),
        content: '',
        type: 'single',
        answers: [],
      },
    ])
  }

  const updateQuestion = (index: number, data: Partial<Question>) => {
    const copy = [...questions]
    copy[index] = { ...copy[index], ...data }
    setQuestions(copy)
  }

  const addAnswer = (qIndex: number) => {
    const copy = [...questions]
    copy[qIndex].answers.push({
      id: crypto.randomUUID(),
      content: '',
      is_correct: false,
    })
    setQuestions(copy)
  }

  const updateAnswer = (
    qIndex: number,
    aIndex: number,
    data: Partial<Answer>
  ) => {
    const copy = [...questions]
    copy[qIndex].answers[aIndex] = {
      ...copy[qIndex].answers[aIndex],
      ...data,
    }
    setQuestions(copy)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Section 2: Câu hỏi</h2>

      {questions.map((q, qIndex) => (
        <div key={q.id} className="border p-4 space-y-3">
          <div className="font-medium">Câu hỏi {qIndex + 1}</div>

          <textarea
            className="w-full border p-2"
            placeholder="Nội dung câu hỏi"
            value={q.content}
            onChange={e =>
              updateQuestion(qIndex, { content: e.target.value })
            }
          />

          <select
            className="border p-2"
            value={q.type}
            onChange={e =>
              updateQuestion(qIndex, {
                type: e.target.value as QuestionType,
                answers: [],
              })
            }
          >
            <option value="single">1 đáp án</option>
            <option value="multiple">Nhiều đáp án</option>
            <option value="essay">Tự luận</option>
          </select>

          {q.type !== 'essay' && (
            <div className="space-y-2">
              {q.answers.map((a, aIndex) => (
                <div key={a.id} className="flex items-center gap-2">
                  <input
                    type={q.type === 'single' ? 'radio' : 'checkbox'}
                    checked={a.is_correct}
                    onChange={e =>
                      updateAnswer(qIndex, aIndex, {
                        is_correct: e.target.checked,
                      })
                    }
                  />
                  <input
                    className="flex-1 border p-1"
                    placeholder="Đáp án"
                    value={a.content}
                    onChange={e =>
                      updateAnswer(qIndex, aIndex, {
                        content: e.target.value,
                      })
                    }
                  />
                </div>
              ))}

              <button
                onClick={() => addAnswer(qIndex)}
                className="text-sm text-blue-600"
              >
                + Thêm đáp án
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addQuestion}
        className="px-3 py-2 border border-dashed"
      >
        + Thêm câu hỏi
      </button>
    </div>
  )
}
