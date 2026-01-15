'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'


interface Question {
  id: string
  content: string
  type: string
  score: number
}

export default function QuestionsPage() {
    const supabase = createClient()
    
  const params = useParams()
  const testId = params.id
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    const { data, error } = await supabase.from('questions').select('*').eq('test_id', testId)
    if (error) console.error(error)
    else setQuestions(data as Question[])
    setLoading(false)
  }

  const deleteQuestion = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa câu hỏi này?')) return
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) console.error(error)
    else fetchQuestions()
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Danh sách câu hỏi</h1>
        <Link href={`/tests/${testId}/questions/create`} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Thêm câu hỏi
        </Link>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : questions.length === 0 ? (
        <p>Chưa có câu hỏi nào.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2">Content</th>
              <th className="border px-4 py-2">Type</th>
              <th className="border px-4 py-2">Score</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map(q => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="border px-4 py-2">{q.content}</td>
                <td className="border px-4 py-2">{q.type}</td>
                <td className="border px-4 py-2">{q.score}</td>
                <td className="border px-4 py-2 space-x-2">
                  <Link href={`/tests/${testId}/questions/${q.id}/edit`} className="text-blue-500 hover:underline">Edit</Link>
                  <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
