'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

function randomCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export default function ManageTests() {
  const supabase = createClient()
  const [tests, setTests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [issued, setIssued] = useState<Record<string, string[]>>({}) // testId -> codes vừa cấp



  useEffect(() => {
    const fetchTests = async () => {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) alert(error.message)
      setTests(data || [])
      setLoading(false)
    }

    fetchTests()
  }, [])

  const reloadOne = async (id: string) => {
    const { data, error } = await supabase.from('tests').select('*').eq('id', id).single()
    if (!error && data) {
      setTests(prev => prev.map(t => (t.id === id ? data : t)))
    }
  }

  const togglePublish = async (test: any) => {
    setBusyId(test.id)
    setIssued(prev => ({ ...prev, [test.id]: [] }))

    const nextStatus = test.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('tests').update({ status: nextStatus }).eq('id', test.id)
    if (error) alert(error.message)

    await reloadOne(test.id)
    setBusyId(null)
  }

  const issueCodes = async (test: any) => {
    if (test.status !== 'published') {
      alert('Phải xuất bản trước khi cấp mã.')
      return
    }

    setBusyId(test.id)

    const codes = [randomCode(8), randomCode(8), randomCode(8)]
    const payload = codes.map(code => ({
      test_id: test.id,
      code,
      is_used: false,
    }))

    const { error } = await supabase.from('test_access_codes').insert(payload)
    if (error) {
      alert(error.message)
      setBusyId(null)
      return
    }

    setIssued(prev => ({ ...prev, [test.id]: codes }))
    setBusyId(null)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('✅ Đã copy')
    } catch { }
  }


  if (loading) return <div className="text-white">Đang tải...</div>

  return (
    <div className="space-y-6 p-6 bg-white/10 rounded-xl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-orange-400">Quản lý bài test</h1>

        <Link href="/tests/manage/create" className="px-6 py-3 bg-orange-500 text-white rounded-xl">
          + Tạo mới
        </Link>
      </div>

      <table className="w-full text-white">
        <thead>
          <tr className="border-b border-white/20">
            <th className="p-3 text-left">Tiêu đề</th>
            <th className="p-3">Thời gian</th>
            <th className="p-3">Điểm đậu</th>
            <th className="p-3">Trạng thái</th>
            <th className="p-3">Hành động</th>
          </tr>
        </thead>

        <tbody>
          {tests.map(test => {
            const isBusy = busyId === test.id
            const justIssued = issued[test.id] || []
            const playPath = `/tests/${test.id}`

            return (
              // ✅ CHỈ 1 TR / 1 TEST => HẾT LỖI KEY
              <tr key={test.id} className="border-b border-white/10 align-top">
                {/* TIÊU ĐỀ + LINK + MÃ */}
                <td className="p-3">
                  <div className="font-semibold">{test.title}</div>

                  {/* ✅ Link chỉ hiện khi published */}
                  {test.status === 'published' ? (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <a
                        className="underline text-orange-200"
                        href={playPath}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Link làm bài
                      </a>
                      <button
                        onClick={() => copy(`${window.location.origin}${playPath}`)}
                        className="px-2 py-1 bg-white/10 rounded"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-300">
                      (Chưa xuất bản → link làm bài bị khóa)
                    </div>
                  )}

                  {justIssued.length > 0 && (
                    <div className="mt-3 bg-white/10 rounded-lg p-3">
                      <div className="font-semibold text-orange-200">
                        3 mã vừa cấp (dùng 1 lần)
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {justIssued.map(code => (
                          <span key={code} className="font-mono px-3 py-1 rounded bg-white/10">
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </td>

                {/* THỜI GIAN */}
                <td className="p-3 text-center">
                  {test.duration_minutes ? `${test.duration_minutes} phút` : 'Không giới hạn'}
                </td>

                {/* ĐIỂM */}
                <td className="p-3 text-center">{test.pass_score}%</td>

                {/* TRẠNG THÁI */}
                <td className="p-3 text-center">
                  {test.status === 'published' ? 'Xuất bản' : 'Nháp'}
                </td>

                {/* ACTIONS */}
                <td className="p-3">
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Link href={`/tests/manage/${test.id}/questions`} className="px-2 py-1 bg-blue-500/20 rounded">
                      Câu hỏi
                    </Link>

                    <Link href={`/tests/manage/${test.id}/edit`} className="px-2 py-1 bg-orange-500/20 rounded">
                      Sửa
                    </Link>

                    <button
                      onClick={() => togglePublish(test)}
                      disabled={isBusy}
                      className="px-2 py-1 bg-green-500/20 rounded disabled:opacity-50"
                    >
                      {isBusy ? 'Đang...' : test.status === 'published' ? 'Ngưng' : 'Xuất bản'}
                    </button>

                    <button
                      onClick={() => issueCodes(test)}
                      disabled={isBusy || test.status !== 'published'}
                      className="px-2 py-1 bg-purple-500/20 rounded disabled:opacity-50"
                      title={test.status !== 'published' ? 'Xuất bản trước khi cấp mã' : ''}
                    >
                      {isBusy ? 'Đang...' : 'Cấp mã'}
                    </button>

                    <button
                      onClick={async () => {
                        if (!confirm('Xoá bài test?')) return
                        await supabase.from('tests').delete().eq('id', test.id)
                        setTests(prev => prev.filter(t => t.id !== test.id))
                      }}
                      className="px-2 py-1 bg-red-500/20 rounded"
                    >
                      Xoá
                    </button>


                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>



    </div >
  )
}
