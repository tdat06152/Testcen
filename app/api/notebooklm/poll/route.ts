import { NextResponse } from 'next/server'
import { NotebookLMClient } from '@/lib/notebooklm'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const notebookId = searchParams.get('notebookId')
        const artifactId = searchParams.get('artifactId')

        if (!notebookId || !artifactId) {
            console.error('API Poll Error: Missing parameters', { notebookId, artifactId });
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const client = new NotebookLMClient()
        const quiz = await client.pollStudio(notebookId, artifactId)

        if (quiz) {
            return NextResponse.json({ status: 'completed', quiz })
        } else {
            return NextResponse.json({ status: 'pending' })
        }
    } catch (error: any) {
        console.error('API Poll Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
