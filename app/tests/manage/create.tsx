'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CreateTestPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(15)
  const [passScore, setPassScore] = useState(3)
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('tests').insert({
      title,
      description,
      duration_minutes: duration,
      pass_score: passScore,
      is_active: isActive
    })
    setLoading(false)
    if (error) alert(error.message)
    else router.push('/tests/manage')
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Tạo Bài Test Mới</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                 className="w-full border px-3 py-2 rounded"/>
        </div>
        <div>
          <label className="block font-medium">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
                    className="w-full border px-3 py-2 rounded"/>
        </div>
        <div>
          <label className="block font-medium">Duration (minutes)</label>
          <input type="number" value={duration} min={1} onChange={e => setDuration(Number(e.target.value))}
                 className="w-full border px-3 py-2 rounded"/>
        </div>
        <div>
          <label className="block font-medium">Pass Score</label>
          <input type="number" value={passScore} min={1} onChange={e => setPassScore(Number(e.target.value))}
                 className="w-full border px-3 py-2 rounded"/>
        </div>
        <div className="flex items-center space-x-2">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}/>
          <span>Active</span>
        </div>
        <button type="submit" disabled={loading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          {loading ? 'Đang tạo...' : 'Tạo Test'}
        </button>
      </form>
    </div>
  )
}
