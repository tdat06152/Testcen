'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function TakeTestPage() {
  const supabase = createClient()
  const params = useParams<{ id: string }>()
  const testId = params?.id

  const [loading, setLoading] = useState(true)
  const [test, setTest] = useState<any>(null)

  const [needsCode, setNeedsCode] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [accessGranted, setAccessGranted] = useState(false)

  useEffect(() => {
    if (!testId) return

    const load = async () => {
      setLoading(true)

      const { data: t, error: tErr } = await supabase.from('tests').select('*').eq('id', testId).single()
      if (tErr) {
        alert(tErr.message)
        setLoading(false)
        return
      }
      setTest(t)

      // ❌ chưa xuất bản => chặn
      if (t.status !== 'published') {
        setNeedsCode(false)
        setAccessGranted(false)
        setLoading(false)
        return
      }

      // ✅ published => check có mã chưa dùng không
      const { data: codes, error: cErr } = await supabase
        .from('test_access_codes')
        .select('id')
        .eq('test_id', testId)
        .eq('is_used', false)
        .limit(1)

      if (cErr) {
        // nếu bảng chưa có / RLS chặn, tạm cho vào để dev
        console.warn(cErr)
        setNeedsCode(false)
        setAccessGranted(true)
        setLoading(false)
        return
      }

      const hasUnused = (codes ?? []).length > 0
      setNeedsCode(hasUnused)
      setAccessGranted(!hasUnused)
      setLoading(false)
    }

    load()
  }, [testId])

  const verifyAndConsume = async () => {
    if (!testId) return
    const code = codeInput.trim().toUpperCase()
    if (!code) return alert('Nhập mã')

    setVerifying(true)

    const { data: row, error } = await supabase
      .from('test_access_codes')
      .select('id')
      .eq('test_id', testId)
      .eq('code', code)
      .eq('is_used', false)
      .single()

    if (error) {
      setVerifying(false)
      return alert('Mã không đúng hoặc đã dùng.')
    }

    const { error: uErr } = await supabase
      .from('test_access_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('is_used', false)

    if (uErr) {
      setVerifying(false)
      return alert(uErr.message)
    }

    setAccessGranted(true)
    setNeedsCode(false)
    setVerifying(false)
  }

  if (loading) return <div className="p-8">Đang tải...</div>

  if (test?.status !== 'published') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-white text-gray-900">
        <div className="max-w-lg w-full border rounded-xl p-6">
          <div className="text-2xl font-bold">Bài kiểm tra chưa được xuất bản</div>
          <div className="text-gray-600 mt-2">Bạn chưa thể vào làm bài.</div>
        </div>
      </div>
    )
  }

  if (needsCode && !accessGranted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-white text-gray-900">
        <div className="max-w-lg w-full border rounded-xl p-6 space-y-4">
          <div className="text-2xl font-bold">{test?.title || 'Làm bài'}</div>
          <div className="text-gray-600">Bài này yêu cầu mã (mỗi mã dùng 1 lần).</div>

          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            placeholder="Nhập mã (VD: ABCD1234)"
            className="w-full h-11 px-3 border border-gray-300 rounded-lg font-mono"
          />

          <button
            onClick={verifyAndConsume}
            disabled={verifying}
            className="w-full px-5 py-3 rounded-lg bg-[#ff5200] text-white font-semibold disabled:opacity-50"
          >
            {verifying ? 'Đang kiểm tra...' : 'Vào làm bài'}
          </button>
        </div>
      </div>
    )
  }

  // ✅ chỗ này mày gắn UI làm bài thật của mày vào
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-8 py-10 space-y-4">
        <h1 className="text-3xl font-bold">{test?.title || 'Làm bài kiểm tra'}</h1>
        {test?.description && <div className="text-gray-600">{test.description}</div>}

        <div className="border rounded-xl p-6">
          ✅ Được vào làm bài. (Gắn UI làm bài thật ở đây)
        </div>
      </div>
    </div>
  )
}
