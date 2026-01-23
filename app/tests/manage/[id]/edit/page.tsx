'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type TestRow = {
  id: string
  title: string
  description: string | null
  pass_score: number | null
  time_limit: number | boolean | null
  duration_minutes: number | null
  valid_from: string | null
  valid_to: string | null
  success_message: string | null
  fail_message: string | null
  allow_review: boolean | null
}

function toDatetimeLocal(value: string | null) {
  if (!value) return ''
  // value có thể là ISO string: 2026-01-10T12:00:00.000Z
  // input datetime-local cần: YYYY-MM-DDTHH:mm
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string) {
  // datetime-local trả về dạng local: YYYY-MM-DDTHH:mm
  // Supabase nhận ISO hoặc string; gửi thẳng cũng được, nhưng chuẩn nhất convert ISO
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function EditTestPage() {
  // ✅ Fix lỗi params Promise: dùng useParams() cho Client Component
  const params = useParams<{ id: string }>()
  const testId = params?.id
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    passScore: 80,

    unlimitedTime: true,
    // thời gian làm bài (minutes) trong DB
    timeMinutes: 60,

    validFrom: '',
    validTo: '',
    successMessage: '',
    failMessage: '',
    allowReview: true,
  })

  // Load test info
  useEffect(() => {
    if (!testId) return

    const load = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('tests')
        .select(
          'id, title, description, pass_score, time_limit, duration_minutes, valid_from, valid_to, success_message, fail_message, allow_review'
        )
        .eq('id', testId)
        .single()

      if (error) {
        alert(error.message)
        setLoading(false)
        return
      }

      const t = data as TestRow

      // time_limit của bạn đang dùng 0/1 (theo code create)
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
      })

      setLoading(false)
    }

    load()
  }, [testId])

  const saveInfo = async () => {
    if (!testId) return
    if (!form.name.trim()) {
      alert('Chưa nhập tên bài kiểm tra')
      return
    }

    setSaving(true)

    // map UI -> DB (giống code create của bạn)
    const payload = {
      title: form.name.trim(),
      description: form.description?.trim() || null,
      pass_score: Number(form.passScore),

      // time_limit: 1 = có giới hạn, 0 = không giới hạn
      time_limit: form.unlimitedTime ? 0 : 1,
      duration_minutes: form.unlimitedTime ? 0 : Number(form.timeMinutes),

      valid_from: form.validFrom ? fromDatetimeLocal(form.validFrom) : null,
      valid_to: form.validTo ? fromDatetimeLocal(form.validTo) : null,

      success_message: form.successMessage?.trim() || null,
      fail_message: form.failMessage?.trim() || null,
      allow_review: !!form.allowReview,
    }

    const { error } = await supabase.from('tests').update(payload).eq('id', testId)

    if (error) {
      alert(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    alert('✅ Đã cập nhật thông tin bài kiểm tra')
  }

  const title = useMemo(() => {
    return form.name?.trim() ? `Sửa bài kiểm tra: ${form.name}` : 'Sửa bài kiểm tra'
  }, [form.name])

  if (loading) {
    return <div className="p-8">Đang tải...</div>
  }

  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-8 pb-32">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{title}</h1>

          <button
            onClick={saveInfo}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-[#ff5200] text-white font-semibold disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>

        {/* SECTION 1: thông tin cơ bản */}
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
                onChange={e => setForm({ ...form, passScore: Number(e.target.value) })}
                className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
              />
            </Field>
          </div>

          <Field label="Mô tả">
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full min-h-[110px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
            />
          </Field>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.unlimitedTime}
                  onChange={e => setForm({ ...form, unlimitedTime: e.target.checked })}
                />
                Không giới hạn thời gian
              </label>

              {!form.unlimitedTime && (
                <Field label="Thời gian làm bài (phút)">
                  <input
                    type="number"
                    placeholder="Thời gian (phút)"
                    value={form.timeMinutes}
                    onChange={e => setForm({ ...form, timeMinutes: Number(e.target.value) })}
                    className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </Field>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.allowReview}
                onChange={e => setForm({ ...form, allowReview: e.target.checked })}
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
                onChange={e => setForm({ ...form, successMessage: e.target.value })}
                className="w-full min-h-[90px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
              />
            </Field>

            <Field label="Thông báo khi chưa đạt">
              <textarea
                value={form.failMessage}
                onChange={e => setForm({ ...form, failMessage: e.target.value })}
                className="w-full min-h-[90px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* SAVE BAR (fixed) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4 flex justify-end">
        <button
          onClick={saveInfo}
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-[#ff5200] text-white font-bold text-lg disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
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
