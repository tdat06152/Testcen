import fs from 'fs'
import path from 'path'
import os from 'os'

export interface Notebook {
    id: string
    title: string
}

export interface QuizQuestion {
    question: string
    options: {
        text: string
        isCorrect: boolean
    }[]
}

export class NotebookLMClient {
    private cookies: Record<string, string> = {}
    private csrfToken: string = ''
    private sessionId: string = ''
    private baseUrl = 'https://notebooklm.google.com'
    private batchExecuteUrl = `${this.baseUrl}/_/LabsTailwindUi/data/batchexecute`
    private queryEndpoint = '/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed'
    private reqId = Math.floor(Math.random() * 900000) + 100000
    private debugLogPath = '/Users/dollarxdustin/notebooklm_debug.log'

    private logToFile(message: string, obj?: any) {
        const timestamp = new Date().toISOString()
        let logMessage = `[${timestamp}] ${message}\n`
        if (obj) {
            logMessage += JSON.stringify(obj, null, 2) + '\n'
        }
        fs.appendFileSync(this.debugLogPath, logMessage)
        console.log(message)
    }

    constructor() {
        this.loadAuth()
    }

    private loadAuth() {
        try {
            const authPath = path.join(os.homedir(), '.notebooklm-mcp', 'auth.json')
            console.log('[NotebookLMClient] Loading auth from:', authPath)
            if (fs.existsSync(authPath)) {
                const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'))
                this.cookies = authData.cookies || {}
                this.csrfToken = authData.csrf_token || ''
                this.sessionId = authData.session_id || ''
                console.log('[NotebookLMClient] Auth loaded. Cookies:', Object.keys(this.cookies).length, 'CSRF:', !!this.csrfToken, 'SID:', !!this.sessionId)
            }
        } catch (error) {
            console.error('[NotebookLMClient] Failed to load auth:', error)
        }
    }

    async refreshAuthTokens() {
        console.log('[NotebookLMClient] Refreshing tokens...')
        const headers = this.getHeaders()
        const res = await fetch(`${this.baseUrl}/`, { headers })

        if (!res.ok) throw new Error(`Failed to fetch home page: ${res.status}`)
        const html = await res.text()

        let found = false
        const csrfMatch = html.match(/"SNlM0e":"([^"]+)"/)
        if (csrfMatch) {
            this.csrfToken = csrfMatch[1]
            console.log('[NotebookLMClient] Fresh CSRF token extracted')
            found = true
        }

        const sidMatch = html.match(/"FdrFJe":"([^"]+)"/)
        if (sidMatch) {
            this.sessionId = sidMatch[1]
            console.log('[NotebookLMClient] Fresh Session ID extracted')
            found = true
        }

        if (!found) {
            this.logToFile('!!! Refresh tokens failed: Could not find CSRF or Session ID in HTML. Cookies might be invalid.')
            // Log the HTML title to see where we are
            const titleMatch = html.match(/<title>(.*?)<\/title>/)
            this.logToFile(`Page Title: ${titleMatch ? titleMatch[1] : 'Unknown'}`)
        }
    }

    private getHeaders() {
        const cookieStr = Object.entries(this.cookies)
            .map(([k, v]) => `${k.trim()}=${v.trim()}`)
            .join('; ')

        return {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'Origin': this.baseUrl,
            'Referer': `${this.baseUrl}/`,
            'Cookie': cookieStr,
            'X-Same-Domain': '1',
            'X-Goog-AuthUser': '0',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        }
    }

    private buildRequestBody(rpcId: string, params: any) {
        // Match Python's separators=(',', ':') - VERY IMPORTANT: NO SPACES
        const paramsJson = JSON.stringify(params)
        const fReq = [[[rpcId, paramsJson, null, 'generic']]]
        const fReqJson = JSON.stringify(fReq)

        let body = `f.req=${encodeURIComponent(fReqJson)}`
        if (this.csrfToken) {
            body += `&at=${encodeURIComponent(this.csrfToken)}`
        }
        return body + '&'
    }

    private buildUrl(rpcId: string, sourcePath: string = '/') {
        const params = new URLSearchParams({
            rpcids: rpcId,
            'source-path': sourcePath,
            bl: 'boq_labs-tailwind-frontend_20260129.10_p0',
            hl: 'en',
            rt: 'c',
            _reqid: String(this.reqId),
        })
        this.reqId += 100000
        if (this.sessionId) {
            params.append('f.sid', this.sessionId)
        }
        return `${this.batchExecuteUrl}?${params.toString()}`
    }

    private updateCookiesFromResponse(headers: Headers) {
        // Node's fetch provides getSetCookie() in newer versions
        const setCookies = (headers as any).getSetCookie ? (headers as any).getSetCookie() : headers.get('set-cookie')?.split(', ') || []

        for (const cookieStr of setCookies) {
            const [kv] = cookieStr.split(';')
            if (kv) {
                const [k, v] = kv.split('=')
                if (k && v) {
                    this.cookies[k.trim()] = v.trim()
                }
            }
        }
    }

    private parseResponse(responseText: string): any[] {
        if (responseText.startsWith(")]}'")) {
            responseText = responseText.substring(4)
        }

        const lines = responseText.trim().split('\n')
        const results: any[] = []

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue

            // Google returns byte counts followed by JSON chunks
            if (!/^\d+$/.test(line)) {
                try {
                    results.push(JSON.parse(line))
                } catch (e) { }
            } else {
                i++
                if (i < lines.length) {
                    try {
                        results.push(JSON.parse(lines[i]))
                    } catch (e) { }
                }
            }
        }
        return results
    }

    private extractRpcResult(parsedResponse: any[], rpcId: string): any {
        for (const chunk of parsedResponse) {
            if (Array.isArray(chunk)) {
                for (const item of chunk) {
                    if (Array.isArray(item) && item.length >= 2) {
                        if (item[0] === 'wrb.fr' && item[1] === rpcId) {
                            // Check for error code 16 (Unauthenticated) in item[5]
                            if (item.length >= 6 && Array.isArray(item[5]) && item[5][0] === 16) {
                                console.log(`[NotebookLMClient] RPC ${rpcId} returned auth error 16`);
                                return { __error_16: true };
                            }
                            const resultStr = item[2];
                            if (typeof resultStr === 'string' && (resultStr.startsWith('[') || resultStr.startsWith('{'))) {
                                try {
                                    return JSON.parse(resultStr);
                                } catch (e) {
                                    return resultStr;
                                }
                            }
                            return resultStr;
                        }
                    }
                }
            }
        }
        return null;
    }

    async listNotebooks(): Promise<Notebook[]> {
        const rpcId = 'wXbhsf'
        const params = [null, 1, null, [2]]
        const body = this.buildRequestBody(rpcId, params)
        const url = this.buildUrl(rpcId)

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body,
        })

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const text = await res.text()
        const parsed = this.parseResponse(text)
        const result = this.extractRpcResult(parsed, rpcId)

        if (!result || !Array.isArray(result)) return []
        // result is [[title, sources, id, ...]]
        if (Array.isArray(result[0])) {
            return (result[0] as any[]).map((nb: any) => ({
                id: nb[2],
                title: nb[0],
            }))
        }
        return []
    }

    private findXsrfInError(obj: any): string | null {
        if (!obj) return null
        if (Array.isArray(obj)) {
            if (obj.length >= 2 && obj[0] === 'xsrf' && typeof obj[1] === 'string') return obj[1]
            for (const item of obj) {
                const found = this.findXsrfInError(item)
                if (found) return found
            }
        } else if (typeof obj === 'object') {
            for (const key in obj) {
                const found = this.findXsrfInError(obj[key])
                if (found) return found
            }
        }
        return null
    }

    async createNotebook(title: string): Promise<string> {
        const rpcId = 'CCqFvf'
        const params = [title, null, null, [2], [1, null, null, null, null, null, null, null, null, null, [1]]]
        this.logToFile(`>>> createNotebook: ${title}`)

        const makeRequest = async () => {
            const body = this.buildRequestBody(rpcId, params)
            const url = this.buildUrl(rpcId)
            const headers = this.getHeaders()
            this.logToFile(`Requesting ${url}`, { headers, body })
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body,
            })
            this.updateCookiesFromResponse(res.headers)
            return res
        }

        let res = await makeRequest()
        let text = res.status === 200 ? await res.text() : await res.text()
        this.logToFile(`Response Status: ${res.status}`, { text: text.substring(0, 1000) })

        let parsed = this.parseResponse(text)
        let result = this.extractRpcResult(parsed, rpcId)

        // Auto-fix XSRF from 400 error
        if (res.status === 400) {
            const newToken = this.findXsrfInError(parsed)
            if (newToken) {
                this.logToFile(`!!! Auto-fixing XSRF token from 400 error: ${newToken}`)
                this.csrfToken = newToken
                // Retry immediately with new token
                res = await makeRequest()
                text = await res.text()
                this.logToFile(`Retry (XSRF fix) Status: ${res.status}`)
                parsed = this.parseResponse(text)
                result = this.extractRpcResult(parsed, rpcId)
            }
        }

        if (res.status === 401 || res.status === 403 || (result && result.__error_16) || (Array.isArray(result) && result[0] === 'wrb.fr' && Array.isArray(result[5]) && result[5][0] === 16)) {
            this.logToFile('!!! Auth failure detected (HTTP ' + res.status + ' or Error 16), refreshing tokens...')
            await this.refreshAuthTokens()
            res = await makeRequest()
            text = await res.text()
            this.logToFile(`Retry Response Status: ${res.status}`, { text: text.substring(0, 1000) })
            parsed = this.parseResponse(text)
            result = this.extractRpcResult(parsed, rpcId)
        }

        if (!res.ok || !result || result.__error_16 || (Array.isArray(result) && result[0] === 'wrb.fr' && Array.isArray(result[5]) && result[5][0] === 16)) {
            this.logToFile('XXX Create notebook failed after retry', { status: res.status, result })
            const preview = text.length > 500 ? text.substring(0, 500) + '...' : text
            throw new Error(`Create notebook failed (Status: ${res.status}). Result valid: ${!!result}. Response preview: ${preview}`)
        }

        const notebookId = Array.isArray(result) ? result[2] : result[0][2]
        this.logToFile(`<<< createNotebook Success: ${notebookId}`)
        return notebookId
    }

    async addTextSource(notebookId: string, text: string, title: string = 'Pasted Text'): Promise<string> {
        const rpcId = 'izAoDd'
        const sourceData = [null, [title, text], null, 2, null, null, null, null, null, null, 1]
        const params = [
            [sourceData],
            notebookId,
            [2],
            [1, null, null, null, null, null, null, null, null, null, [1]]
        ]

        const makeRequest = async () => {
            const body = this.buildRequestBody(rpcId, params)
            const url = this.buildUrl(rpcId, `/notebook/${notebookId}`)
            const res = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body,
            })
            this.updateCookiesFromResponse(res.headers)
            return res
        }

        let res = await makeRequest()
        let textResult = await res.status === 200 ? await res.text() : ''
        let parsed = textResult ? this.parseResponse(textResult) : []
        let result = this.extractRpcResult(parsed, rpcId)

        if (res.status === 401 || res.status === 403 || (result && result.__error_16)) {
            console.log('[NotebookLMClient] Auth error in addTextSource, refreshing...')
            await this.refreshAuthTokens()
            res = await makeRequest()
            textResult = await res.text()
            parsed = this.parseResponse(textResult)
            result = this.extractRpcResult(parsed, rpcId)
        }

        if (!result || result.__error_16) throw new Error('Add source failed after auth retry')
        return result[0][0][0][0]
    }

    async createQuiz(notebookId: string, sourceIds: string[]): Promise<string> {
        const rpcId = 'R7cb6c'
        const sourcesNested = sourceIds.map(sid => [[sid]])
        const quizOptions = [
            null,
            [
                2, // Format: QUiz
                null, null, null, null, null, null,
                [5, 2] // [count=5, difficulty=2]
            ]
        ]
        const content = [
            null, null,
            4,
            sourcesNested,
            null, null, null, null, null,
            quizOptions
        ]
        const params = [[2], notebookId, content]

        const makeRequest = async () => {
            const body = this.buildRequestBody(rpcId, params)
            const url = this.buildUrl(rpcId, `/notebook/${notebookId}`)
            const res = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body,
            })
            this.updateCookiesFromResponse(res.headers)
            return res
        }

        let res = await makeRequest()
        let textResult = await res.status === 200 ? await res.text() : ''
        let parsed = textResult ? this.parseResponse(textResult) : []
        let result = this.extractRpcResult(parsed, rpcId)

        if (res.status === 401 || res.status === 403 || (result && result.__error_16)) {
            console.log('[NotebookLMClient] Auth error in createQuiz, refreshing...')
            await this.refreshAuthTokens()
            res = await makeRequest()
            textResult = await res.text()
            parsed = this.parseResponse(textResult)
            result = this.extractRpcResult(parsed, rpcId)
        }

        if (!result || result.__error_16) throw new Error('Create quiz failed after auth retry')

        // Fix: result is [artifactId, type, ...] or [[artifactId, ...]]
        // Usually result is array of artifacts. We need the ID of the first one.
        // Let's log to be sure if we are unsure, but from previous logs, it seems we grabbed the whole object.

        let artifactId = ''
        if (Array.isArray(result) && result.length > 0) {
            if (Array.isArray(result[0])) {
                // likely [[id, ...], [id, ...]]
                artifactId = result[0][0]
            } else if (typeof result[0] === 'string') {
                // likely [id, type, ...]
                artifactId = result[0]
            }
        }

        if (!artifactId) throw new Error('Could not extract Artifact ID from Create Quiz response')

        this.logToFile(`<<< createQuiz Success: ${artifactId}`)
        return artifactId
    }

    async query(notebookId: string, queryText: string, sourceIds?: string[]): Promise<string> {
        this.logToFile(`>>> Querying Chat: NB=${notebookId} Text=${queryText.substring(0, 50)}...`)

        // Build sources array: [[[sid]]]
        const sourcesArray = sourceIds ? sourceIds.map(sid => [[sid]]) : []

        const params = [
            sourcesArray,
            queryText,
            null, // History
            [2, null, [1]],
            `chat-${Math.random().toString(36).substring(7)}` // Random chat ID
        ]

        const paramsJson = JSON.stringify(params)
        const fReq = [null, paramsJson]
        const fReqJson = JSON.stringify(fReq)
        const body = `f.req=${encodeURIComponent(fReqJson)}&at=${encodeURIComponent(this.csrfToken)}&`

        const urlParams = new URLSearchParams({
            bl: 'boq_labs-tailwind-frontend_20260129.10_p0',
            hl: 'en',
            _reqid: String(this.reqId),
            rt: 'c',
        })
        if (this.sessionId) urlParams.append('f.sid', this.sessionId)

        const url = `${this.baseUrl}${this.queryEndpoint}?${urlParams.toString()}`

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body,
        })

        if (!res.ok) throw new Error(`Query failed: ${res.status}`)

        const textRes = await res.text()
        return this.parseQueryResponse(textRes)
    }

    private parseQueryResponse(responseText: string): string {
        if (responseText.startsWith(")]}'")) responseText = responseText.substring(4)

        const chunks = this.parseResponse(responseText)
        let longestAnswer = ""

        for (const chunk of chunks) {
            const result = this.extractRpcResult([chunk], 'generic') // Query results are often in generic chunks
            // The query parser logic is complex, but often the text is in the first element of inner JSON
            if (typeof result === 'string' && result.length > longestAnswer.length) {
                longestAnswer = result
            } else if (Array.isArray(result)) {
                // If it's an array, look for strings
                const findString = (obj: any): string => {
                    if (typeof obj === 'string') return obj
                    if (Array.isArray(obj)) {
                        for (const item of obj) {
                            const found = findString(item)
                            if (found && found.length > 50) return found
                        }
                    }
                    return ""
                }
                const foundText = findString(result)
                if (foundText.length > longestAnswer.length) longestAnswer = foundText
            }
        }

        return longestAnswer
    }

    async generateQuizChat(notebookId: string, sourceIds: string[]): Promise<QuizQuestion[] | null> {
        const prompt = `Hãy tạo 5 câu hỏi trắc nghiệm tiếng Việt dựa trên nội dung tài liệu này.
Định dạng trả về là một mảng JSON các câu hỏi.
Mỗi câu hỏi có cấu trúc:
{
  "question": "Nội dung câu hỏi?",
  "options": [
    {"text": "Phương án A", "isCorrect": true},
    {"text": "Phương án B", "isCorrect": false},
    {"text": "Phương án C", "isCorrect": false},
    {"text": "Phương án D", "isCorrect": false}
  ]
}
Chỉ trả về mảng JSON, không thêm văn bản khác.`

        const response = await this.query(notebookId, prompt, sourceIds)
        this.logToFile(`<<< Chat Response: ${response.substring(0, 500)}`)

        try {
            // Extract JSON from response (might be wrapped in markdown)
            const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/)
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0])
            }
            // Try parsing whole response if no match
            return JSON.parse(response)
        } catch (e) {
            this.logToFile(`!!! Failed to parse quiz from chat response: ${e}`)
            return null
        }
    }

    async pollStudio(notebookId: string, artifactId: string): Promise<QuizQuestion[] | null> {
        // Fallback to chat if artifactId is empty or we want more reliability
        // In this integrated version, we will try Studio first, then fallback to chat if no data found
        const rpcId = 'gArtLc'
        const params = [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"']
        const body = this.buildRequestBody(rpcId, params)
        const url = this.buildUrl(rpcId, `/notebook/${notebookId}`)

        this.logToFile(`>>> Polling Studio: NB=${notebookId} ART=${artifactId}`)

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body,
        })
        this.updateCookiesFromResponse(res.headers)

        const textRes = await res.text()
        const parsed = this.parseResponse(textRes)
        const result = this.extractRpcResult(parsed, rpcId)

        if (!result || !Array.isArray(result[0])) {
            this.logToFile('... Poll result invalid or empty')
            // Fallback to chat if Studio poll result is invalid or empty
            const sourceIds: string[] = [] // Cannot determine source IDs from a failed poll, so pass empty
            return this.generateQuizChat(notebookId, sourceIds)
        }

        const artifactList = result[0]
        this.logToFile(`... Found ${artifactList.length} artifacts in notebook`)

        const artifact = artifactList.find((a: any) => a[0] === artifactId)
        if (!artifact) {
            this.logToFile(`... Artifact ${artifactId} NOT FOUND in list`)
            // Fallback to chat if artifact not found
            const sourceIds: string[] = [] // Cannot determine source IDs from a failed poll, so pass empty
            return this.generateQuizChat(notebookId, sourceIds)
        }

        const status = artifact[4] // 1: IN_PROGRESS, 3: COMPLETED
        this.logToFile(`... Artifact ${artifactId} Status: ${status} (3=COMPLETED)`)

        if (status !== 3) {
            // If not completed, return null to indicate still polling
            return null
        }

        // Artifact structure for Studio (type 4): [id, title, type, variant, status, ..., data]
        // data is at artifact[9].
        const studioData = artifact[9]
        if (Array.isArray(studioData) && studioData.length > 1) {
            // Try original extraction logic for Studio artifacts
            // For Quiz (variant 2), studioData[1] often contains config [2, null, ...].
            // The actual questions might be in studioData[2] or starting from a certain index in studioData[1].
            let quizItems = []
            if (Array.isArray(studioData[2])) {
                quizItems = studioData[2]
                this.logToFile(`... Found quiz items in studioData[2] (count: ${quizItems.length})`)
            } else if (Array.isArray(studioData[1])) {
                // Check if studioData[1][0] is the variant code '2'. If so, items might be elsewhere or this is just a header.
                if (studioData[1][0] === 2 && studioData[1].length > 0 && !Array.isArray(studioData[1][1])) {
                    this.logToFile('... studioData[1] looks like a config header, searching deeper...')
                    // If it's just a config, we need to find where the actual array of questions is.
                    // Sometimes it's in studioData[1] starting from some index, or in another field.
                    // Let's look at all fields in studioData
                    for (let i = 2; i < studioData.length; i++) {
                        if (Array.isArray(studioData[i]) && studioData[i].length > 0 && Array.isArray(studioData[i][0])) {
                            quizItems = studioData[i]
                            this.logToFile(`... Found potential quiz items in studioData[${i}] (count: ${quizItems.length})`)
                            break
                        }
                    }
                } else {
                    quizItems = studioData[1]
                    this.logToFile(`... Using studioData[1] as quiz items (count: ${quizItems.length})`)
                }
            }

            if (quizItems.length > 0) {
                try {
                    return quizItems.map((item: any, idx: number) => {
                        if (!Array.isArray(item) || typeof item[0] !== 'string') {
                            return null
                        }
                        const question = item[0] || 'Câu hỏi không có nội dung'
                        const optionsData = item[1] || []

                        let options: { text: string; isCorrect: boolean }[] = []
                        if (Array.isArray(optionsData)) {
                            options = optionsData.map((opt: any) => {
                                if (!Array.isArray(opt)) return null
                                return {
                                    text: String(opt[0] || ''),
                                    isCorrect: !!opt[1],
                                }
                            }).filter(Boolean) as { text: string; isCorrect: boolean }[]
                        }

                        return { question, options }
                    }).filter(Boolean) as QuizQuestion[]
                } catch (e: any) {
                    this.logToFile(`!!! Studio Extraction Loop Error: ${e.message}`)
                    // Fallback to chat if Studio extraction fails
                    const sourceIds: string[] = artifact && artifact[3] ? (artifact[3] as any[]).map(s => s[0][0][0]) : []
                    return this.generateQuizChat(notebookId, sourceIds)
                }
            }
        }

        // FALLBACK: If Studio failed or gave no data, use CHAT
        this.logToFile('... Falling back to Chat-based quiz generation for reliable data')

        // We need source IDs. Let's get them from the artifact or notebook
        const sourceIds: string[] = artifact && artifact[3] ? (artifact[3] as any[]).map(s => s[0][0][0]) : []
        return this.generateQuizChat(notebookId, sourceIds)
    }
}
