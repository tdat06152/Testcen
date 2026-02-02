'use client'

import { useEffect, useState, type ClipboardEvent } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import * as XLSX from 'xlsx'

type QuestionType = 'single' | 'multiple' | 'essay'

type BankAnswer = {
    id?: string
    content: string
    is_correct: boolean
    images: string[]
}

type BankQuestion = {
    id: string
    content: string
    type: QuestionType
    difficulty: 'Easy' | 'Medium' | 'Hard'
    category_id: string | null
    images: string[]
    answers: BankAnswer[]
}

type Category = {
    id: string
    name: string
    description: string | null
}

const BUCKET = 'bank'

async function uploadImageToStorage(supabase: any, file: File) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl as string
}

function getPastedImageFile(e: ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return null
    const imgItem = Array.from(items).find(it => it.type.startsWith('image/'))
    return imgItem ? imgItem.getAsFile() : null
}

export default function QuestionBankPage() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [categories, setCategories] = useState<Category[]>([])
    const [questions, setQuestions] = useState<BankQuestion[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
    const [showAddCategory, setShowAddCategory] = useState(false)
    const [newCatName, setNewCatName] = useState('')
    const [newCatDesc, setNewCatDesc] = useState('')
    const [editingQuestion, setEditingQuestion] = useState<Partial<BankQuestion> | null>(null)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [importing, setImporting] = useState(false)
    const [isAiLoading, setIsAiLoading] = useState(false)

    const aiRefineQuestion = async () => {
        if (!editingQuestion?.content) return
        setIsAiLoading(true)
        try {
            const res = await fetch('/api/ai/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'refine-question', currentContent: editingQuestion.content })
            })
            const data = await res.json()
            if (data.success) {
                setEditingQuestion({ ...editingQuestion, content: data.refinedText })
            } else {
                alert("AI Error: " + data.error)
            }
        } catch (e) { alert("Network Error") }
        finally { setIsAiLoading(false) }
    }

    const aiGenerateDistractors = async () => {
        if (!editingQuestion?.content) return alert("Hảy nhập nội dung câu hỏi trước")
        const correctAns = editingQuestion.answers?.find(a => a.is_correct)?.content
        if (!correctAns) return alert("Hãy nhập và chọn 1 đáp án đúng trước để AI có cơ sở gợi ý")

        setIsAiLoading(true)
        try {
            const res = await fetch('/api/ai/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate-distractors', question: editingQuestion.content, correctAnswer: correctAns })
            })
            const data = await res.json()
            if (data.success && data.distractors) {
                const newAnswers = [
                    ...(editingQuestion.answers?.filter(a => a.is_correct) || []),
                    ...data.distractors.map((text: string) => ({ content: text, is_correct: false, images: [] }))
                ]
                setEditingQuestion({ ...editingQuestion, answers: newAnswers })
            } else { alert("AI Error: " + data.error) }
        } catch (e) { alert("Network Error") }
        finally { setIsAiLoading(false) }
    }

    useEffect(() => {
        loadData()
        checkStorage()
    }, [])

    useEffect(() => {
        const handleHash = () => {
            if (typeof window === 'undefined') return
            const qId = window.location.hash.slice(1)
            if (!qId || loading || questions.length === 0) return

            setSelectedCategory('all')
            setTimeout(() => {
                const el = document.getElementById(qId)
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el.classList.add('ring-4', 'ring-orange-500', 'ring-offset-4', 'transition-all', 'duration-1000')
                    setTimeout(() => el.classList.remove('ring-4', 'ring-orange-500', 'ring-offset-4'), 3000)
                }
            }, 600)
        }
        handleHash()
        window.addEventListener('hashchange', handleHash)
        return () => window.removeEventListener('hashchange', handleHash)
    }, [loading, questions.length])

    const checkStorage = async () => {
        const { data, error } = await supabase.storage.listBuckets()
        if (error) {
            console.error('List Buckets Error:', error)
        } else {
            const bankExists = data?.some((b: any) => b.name === BUCKET)
            if (!bankExists) {
                console.warn(`WARNING: Bucket "${BUCKET}" not found`)
            }
        }
    }

    const loadData = async () => {
        setLoading(true)
        const { data: cats } = await supabase.from('question_bank_categories').select('*').order('name')
        const { data: qs } = await supabase.from('question_bank').select('*').order('created_at', { ascending: false })
        const { data: ans } = await supabase.from('question_bank_answers').select('*')

        const mappedQs: BankQuestion[] = (qs || []).map((q: any) => ({
            ...q,
            difficulty: q.difficulty || 'Easy',
            answers: (ans || []).filter((a: any) => a.question_id === q.id)
        }))

        setCategories(cats || [])
        setQuestions(mappedQs)
        setLoading(false)
    }

    const addCategory = async () => {
        if (!newCatName.trim()) return
        const { error } = await supabase.from('question_bank_categories').insert({ name: newCatName, description: newCatDesc })
        if (error) alert(error.message)
        else { setNewCatName(''); setNewCatDesc(''); setShowAddCategory(false); loadData() }
    }

    const deleteCategory = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Xóa nhóm này? Các câu hỏi trong nhóm sẽ được chuyển về "Mặc định".')) return
        const { error } = await supabase.from('question_bank_categories').delete().eq('id', id)
        if (error) alert(error.message)
        else loadData()
    }

    const deleteQuestion = async (id: string) => {
        if (!confirm('Xóa câu hỏi này?')) return
        await supabase.from('question_bank').delete().eq('id', id)
        loadData()
    }

    const saveQuestion = async () => {
        if (!editingQuestion) return

        // Allow saving if there is either content OR at least one image
        const hasContent = editingQuestion.content?.trim()
        const hasImages = editingQuestion.images && editingQuestion.images.length > 0

        if (!hasContent && !hasImages) return alert('Vui lòng nhập nội dung hoặc thêm ảnh cho câu hỏi')

        const payload = {
            content: editingQuestion.content || '',
            type: editingQuestion.type || 'single',
            difficulty: editingQuestion.difficulty || 'Easy',
            category_id: editingQuestion.category_id || null,
            images: editingQuestion.images || []
        }
        let qId = editingQuestion.id
        if (qId) {
            await supabase.from('question_bank').update(payload).eq('id', qId)
        } else {
            const { data, error } = await supabase.from('question_bank').insert(payload).select().single()
            if (error) return alert(error.message)
            qId = data.id
        }
        await supabase.from('question_bank_answers').delete().eq('question_id', qId)
        if (editingQuestion.type !== 'essay' && editingQuestion.answers) {
            const ansPayload = editingQuestion.answers.map(a => ({
                question_id: qId,
                content: a.content || '',
                is_correct: a.is_correct,
                images: a.images || []
            }))
            await supabase.from('question_bank_answers').insert(ansPayload)
        }
        setEditingQuestion(null); loadData()
    }

    const downloadTemplate = () => {
        const data = [
            ['Câu hỏi', 'Loại câu hỏi', 'Nhóm chủ đề', 'Độ khó (Dễ/Trung bình/Khó)', 'Câu trả lời', 'Đáp án đúng'],
            ['1+1 bằng mấy ?', '1 đáp án', 'Kinh doanh', 'Dễ', '2', 'x'],
            ['', '', '', '', '3', ''],
            ['', '', '', '', '4', ''],
            ['', '', '', '', '5', ''],
            ['Con mèo kêu sao?', 'Nhiều đáp án', 'Mặc định', 'Trung bình', 'Meo', 'x'],
            ['', '', '', '', 'Gâu', ''],
            ['', '', '', '', 'Chó đẻ', 'x'],
            ['', '', '', '', 'Ò ó o', '']
        ]
        const ws = XLSX.utils.aoa_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
        XLSX.writeFile(wb, "Mau_Cau_Hoi.xlsx")
    }

    const handleImportExcel = async (file: File) => {
        setImporting(true)
        try {
            const reader = new FileReader()
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: 'array' })
                const sheet = workbook.Sheets[workbook.SheetNames[0]]
                const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

                // Skip header
                const dataRows = rows.slice(1)
                const parsedQuestions: any[] = []
                let currentQ: any = null

                for (const row of dataRows) {
                    const [qText, qTypeStr, qCatName, qDiffStr, aText, aCorrect] = row

                    if (qText && qText.toString().trim()) {
                        // New Question
                        let type: QuestionType = 'single'
                        if (qTypeStr?.toString().includes('Nhiều')) type = 'multiple'
                        if (qTypeStr?.toString().includes('luận')) type = 'essay'

                        let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Easy'
                        if (qDiffStr?.toString().includes('binh')) difficulty = 'Medium'
                        if (qDiffStr?.toString().includes('Khó')) difficulty = 'Hard'

                        currentQ = {
                            content: qText.toString(),
                            type: type,
                            difficulty: difficulty,
                            category_name: qCatName?.toString() || 'Mặc định',
                            answers: []
                        }
                        parsedQuestions.push(currentQ)
                    }

                    if (currentQ && aText) {
                        currentQ.answers.push({
                            content: aText.toString(),
                            is_correct: aCorrect?.toString().toLowerCase() === 'x'
                        })
                    }
                }

                // Batch save to database
                for (const q of parsedQuestions) {
                    // 1. Find or create category
                    let catId = null
                    if (q.category_name && q.category_name !== 'Mặc định') {
                        const { data: existingCat } = await supabase.from('question_bank_categories').select('id').eq('name', q.category_name).limit(1).maybeSingle()
                        if (existingCat) {
                            catId = existingCat.id
                        } else {
                            const { data: newCat, error: catErr } = await supabase.from('question_bank_categories').insert({ name: q.category_name }).select().single()
                            if (!catErr) catId = newCat?.id
                        }
                    }

                    // 2. Insert question
                    const { data: newQ, error: qErr } = await supabase.from('question_bank').insert({
                        content: q.content,
                        type: q.type,
                        difficulty: q.difficulty,
                        category_id: catId,
                        images: []
                    }).select().single()

                    if (qErr) {
                        console.error('Error importing question:', qErr)
                        continue
                    }

                    // 3. Insert answers
                    if (q.answers.length > 0) {
                        const ansPayload = q.answers.map((a: any) => ({
                            question_id: newQ.id,
                            content: a.content,
                            is_correct: a.is_correct,
                            images: []
                        }))
                        await supabase.from('question_bank_answers').insert(ansPayload)
                    }
                }

                alert(`✅ Đã nhập thành công ${parsedQuestions.length} câu hỏi!`)
                setIsImportModalOpen(false)
                loadData()
                setImporting(false)
            }
            reader.readAsArrayBuffer(file)
        } catch (err: any) {
            alert('Lỗi: ' + err.message)
            setImporting(false)
        }
    }

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">NGÂN HÀNG CÂU HỎI</h1>
                    <p className="text-slate-500 font-medium">Quản lý kho câu hỏi tập trung</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-green-500/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span className="text-xl">📊</span> IMPORT EXCEL
                    </button>
                    <button
                        onClick={() => setEditingQuestion({ content: '', type: 'single', difficulty: 'Easy', answers: [{ content: '', is_correct: false, images: [] }, { content: '', is_correct: false, images: [] }], images: [] })}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                    >
                        + THÊM CÂU HỎI MỚI
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Nhóm câu hỏi</h2>
                            <button onClick={() => setShowAddCategory(true)} className="text-orange-600 text-xs font-black hover:scale-110 transition-transform">+</button>
                        </div>
                        <div className="space-y-1">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all font-bold text-sm ${selectedCategory === 'all' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                Tất cả ({questions.length})
                            </button>
                            {categories.map(cat => (
                                <div
                                    key={cat.id}
                                    className={`group flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${selectedCategory === cat.id ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                                    onClick={() => setSelectedCategory(cat.id)}
                                >
                                    <span className="truncate flex-1">{cat.name} ({questions.filter(q => q.category_id === cat.id).length})</span>
                                    <button
                                        onClick={(e) => deleteCategory(cat.id, e)}
                                        className={`ml-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded transition-all ${selectedCategory === cat.id ? 'text-white' : 'text-slate-400 hover:text-red-500'}`}
                                        title="Xóa nhóm"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20 font-bold text-slate-400 animate-pulse text-xl">ĐANG TẢI DỮ LIỆU...</div>
                    ) : (selectedCategory === 'all' ? questions : questions.filter(q => q.category_id === selectedCategory)).map(q => (
                        <div key={q.id} id={q.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group border-l-8 border-l-orange-500">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                            {q.type === 'essay' ? 'Tự luận' : q.type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án'}
                                        </span>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${q.difficulty === 'Hard' ? 'bg-red-100 text-red-600' :
                                            q.difficulty === 'Medium' ? 'bg-orange-100 text-orange-600' :
                                                'bg-green-100 text-green-600'
                                            }`}>
                                            {q.difficulty === 'Hard' ? 'Khó' : q.difficulty === 'Medium' ? 'Trung bình' : 'Dễ'}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
                                            NHÓM: {categories.find(c => c.id === q.category_id)?.name || 'Mặc định'}
                                        </span>
                                    </div>
                                    <div className="text-slate-800 font-bold text-xl leading-tight whitespace-pre-wrap">{q.content}</div>

                                    {q.images && q.images.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {q.images.map((img, i) => (
                                                <img key={i} src={img} alt="" className="h-24 rounded-xl border border-slate-100 shadow-sm" />
                                            ))}
                                        </div>
                                    )}

                                    {q.type !== 'essay' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                            {q.answers.map((a, i) => (
                                                <div key={i} className={`p-4 rounded-2xl border flex items-center gap-3 ${a.is_correct ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                                                    <div className={`w-2 h-2 rounded-full ${a.is_correct ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-300'}`} />
                                                    <span className="font-bold text-sm">{a.content}</span>
                                                    {a.images && a.images.length > 0 && <span className="ml-auto text-[10px]">🖼️</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingQuestion(q)} className="p-3 bg-slate-50 hover:bg-orange-500 hover:text-white rounded-2xl transition-all">✏️</button>
                                    <button onClick={() => deleteQuestion(q.id)} className="p-3 bg-slate-50 hover:bg-red-500 hover:text-white rounded-2xl transition-all">🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {editingQuestion && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
                    <div className="bg-white rounded-[40px] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/20">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{editingQuestion.id ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mẫu'}</h2>
                            <button onClick={() => setEditingQuestion(null)} className="text-slate-400 hover:text-slate-900 text-2xl">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Loại câu hỏi</label>
                                    <select
                                        value={editingQuestion.type}
                                        onChange={e => setEditingQuestion({ ...editingQuestion, type: e.target.value as QuestionType })}
                                        className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-orange-500 outline-none transition-all"
                                    >
                                        <option value="single">Một đáp án đúng</option>
                                        <option value="multiple">Nhiều đáp án đúng</option>
                                        <option value="essay">Tự luận</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Độ khó</label>
                                    <select
                                        value={editingQuestion.difficulty}
                                        onChange={e => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as any })}
                                        className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-orange-500 outline-none transition-all"
                                    >
                                        <option value="Easy">Dễ</option>
                                        <option value="Medium">Trung bình</option>
                                        <option value="Hard">Khó</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Nhóm (Category)</label>
                                    <select
                                        value={editingQuestion.category_id || ''}
                                        onChange={e => setEditingQuestion({ ...editingQuestion, category_id: e.target.value || null })}
                                        className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-orange-500 outline-none transition-all"
                                    >
                                        <option value="">Mặc định</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Nội dung câu hỏi (Paste ảnh được)</label>
                                <textarea
                                    value={editingQuestion.content}
                                    onChange={e => setEditingQuestion({ ...editingQuestion, content: e.target.value })}
                                    onPaste={async e => {
                                        const file = getPastedImageFile(e)
                                        if (!file) return
                                        e.preventDefault()
                                        try {
                                            const url = await uploadImageToStorage(supabase, file)
                                            setEditingQuestion({ ...editingQuestion, images: [...(editingQuestion.images || []), url] })
                                        } catch (err: any) { alert(`LỖI UPLOAD: ${err.message}`) }
                                    }}
                                    className="w-full min-h-[140px] p-6 bg-slate-50 border-2 border-slate-100 rounded-[30px] font-bold focus:border-orange-500 outline-none transition-all text-lg"
                                    placeholder="Nhập nội dung..."
                                />
                                {editingQuestion.images && editingQuestion.images.length > 0 && (
                                    <div className="flex gap-2 mt-2">
                                        {editingQuestion.images.map((img, i) => (
                                            <div key={i} className="relative group">
                                                <img src={img} className="h-20 w-20 object-cover rounded-xl border" />
                                                <button onClick={() => setEditingQuestion({ ...editingQuestion, images: editingQuestion.images?.filter((_, idx) => idx !== i) })} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {editingQuestion.type !== 'essay' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Các đáp án</label>
                                    </div>
                                    <div className="space-y-3">
                                        {editingQuestion.answers?.map((ans, i) => (
                                            <div key={i} className="space-y-2 p-4 bg-slate-50 rounded-[24px] border-2 border-transparent hover:border-slate-200 transition-all">
                                                <div className="flex gap-3 items-center">
                                                    <input
                                                        type={editingQuestion.type === 'single' ? 'radio' : 'checkbox'}
                                                        checked={ans.is_correct}
                                                        onChange={() => {
                                                            const newAns = [...(editingQuestion.answers || [])]
                                                            if (editingQuestion.type === 'single') newAns.forEach(a => a.is_correct = false)
                                                            newAns[i].is_correct = !newAns[i].is_correct
                                                            setEditingQuestion({ ...editingQuestion, answers: newAns })
                                                        }}
                                                        className="w-6 h-6 border-2 border-slate-300 text-orange-500 focus:ring-orange-500"
                                                    />
                                                    <input
                                                        value={ans.content}
                                                        onChange={e => {
                                                            const newAns = [...(editingQuestion.answers || [])]
                                                            newAns[i].content = e.target.value
                                                            setEditingQuestion({ ...editingQuestion, answers: newAns })
                                                        }}
                                                        onPaste={async e => {
                                                            const file = getPastedImageFile(e)
                                                            if (!file) return
                                                            e.preventDefault()
                                                            try {
                                                                const url = await uploadImageToStorage(supabase, file)
                                                                const newAns = [...(editingQuestion.answers || [])]
                                                                newAns[i].images = [...(newAns[i].images || []), url]
                                                                setEditingQuestion({ ...editingQuestion, answers: newAns })
                                                            } catch (err: any) { alert(err.message) }
                                                        }}
                                                        className="flex-1 h-12 px-5 bg-white border-2 border-slate-100 rounded-xl font-bold focus:border-orange-500 outline-none transition-all"
                                                        placeholder={`Đáp án ${i + 1}`}
                                                    />
                                                    <button onClick={() => setEditingQuestion({ ...editingQuestion, answers: editingQuestion.answers?.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                                                </div>
                                                {ans.images && ans.images.length > 0 && (
                                                    <div className="flex gap-2 pl-9">
                                                        {ans.images.map((img, idx) => (
                                                            <div key={idx} className="relative group">
                                                                <img src={img} className="h-12 w-12 object-cover rounded-lg border" />
                                                                <button onClick={() => {
                                                                    const next = [...(editingQuestion.answers || [])]
                                                                    next[i].images = next[i].images.filter((_, m) => m !== idx)
                                                                    setEditingQuestion({ ...editingQuestion, answers: next })
                                                                }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setEditingQuestion({ ...editingQuestion, answers: [...(editingQuestion?.answers || []), { content: '', is_correct: false, images: [] }] })}
                                        className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[24px] text-orange-500 font-black text-sm hover:bg-orange-50 hover:border-orange-200 transition-all uppercase tracking-widest"
                                    >
                                        + THÊM ĐÁP ÁN
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-4">
                            <button onClick={() => setEditingQuestion(null)} className="px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition-all">HỦY</button>
                            <button onClick={saveQuestion} className="px-10 py-3 rounded-2xl bg-orange-500 text-white font-black shadow-xl shadow-orange-500/30 hover:brightness-110 active:scale-95 transition-all uppercase tracking-tight">Lưu vào ngân hàng</button>
                        </div>
                    </div>
                </div>
            )}

            {showAddCategory && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
                    <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl p-8 space-y-6 border border-white/20">
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Thêm nhóm câu hỏi</h2>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Tên nhóm</label>
                                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-orange-500 outline-none transition-all" placeholder="Ví dụ: Kiến thức chung..." />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Mô tả</label>
                                <textarea value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} className="w-full h-32 p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-orange-500 outline-none transition-all" placeholder="..." />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={() => setShowAddCategory(false)} className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">HỦY</button>
                            <button onClick={addCategory} className="px-8 py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-black transition-all shadow-lg active:scale-95">THÊM NHÓM</button>
                        </div>
                    </div>
                </div>
            )}

            {isImportModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
                    <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl p-8 space-y-6 border border-white/20">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Nhập từ Excel</h2>
                            <button onClick={downloadTemplate} className="text-xs font-black text-orange-500 hover:underline">⬇️ TẢI FILE MẪU</button>
                        </div>

                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-green-500 transition-all relative">
                                {!importing ? (
                                    <>
                                        <span className="text-4xl mb-4 block">📁</span>
                                        <p className="font-bold text-slate-500">Kéo thả hoặc bấm để chọn file Excel (.xlsx)</p>
                                        <input
                                            type="file"
                                            accept=".xlsx"
                                            onChange={e => e.target.files?.[0] && handleImportExcel(e.target.files[0])}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                        <p className="font-black text-green-600 animate-pulse">ĐANG XỬ LÝ DỮ LIỆU...</p>
                                    </div>
                                )}
                            </div>

                            <p className="text-[10px] text-slate-400 font-bold uppercase text-center tracking-widest leading-relaxed">
                                Lưu ý: File Excel phải đúng định dạng mẫu. <br /> Các dòng cùng 1 câu hỏi phải nằm sát nhau.
                            </p>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button onClick={() => setIsImportModalOpen(false)} className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">ĐÓNG</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
