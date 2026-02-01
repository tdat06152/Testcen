import { NextResponse } from 'next/server'
import { NotebookLMClient } from '@/lib/notebooklm'

export const maxDuration = 300; // Increase timeout to 5 minutes

export async function POST(req: Request) {
    try {
        const { text, title } = await req.json()
        if (!text) {
            return NextResponse.json({ error: 'Thiếu nội dung văn bản' }, { status: 400 })
        }

        const client = new NotebookLMClient()
        console.log('--- NotebookLM Generation Start ---')

        // 1. Create a temporary notebook
        console.log('Step 1: Creating notebook...')
        const notebookTitle = `Gen Quiz - ${title || 'Untitled'} - ${new Date().toLocaleString()}`
        const notebookId = await client.createNotebook(notebookTitle)
        console.log('✅ Notebook created ID:', notebookId)

        // 2. Add the text as a source
        console.log('Step 2: Adding text source...')
        const sourceId = await client.addTextSource(notebookId, text, title || 'Tài liệu')
        console.log('✅ Source added ID:', sourceId)

        // 3. Trigger quiz generation
        console.log('Step 3: Triggering quiz creation...')
        const artifactId = await client.createQuiz(notebookId, [sourceId])
        console.log('✅ Quiz artifact created ID:', artifactId)

        // Return immediately so client can poll
        return NextResponse.json({ notebookId, artifactId, status: 'pending' })
    } catch (error: any) {
        console.error('NotebookLM Generation Error:', error)
        return NextResponse.json({ error: error.message || 'Lỗi không xác định' }, { status: 500 })
    }
}
