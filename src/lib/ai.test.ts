import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  trimContent,
  callGemini,
  continueWriting,
  improveWriting,
  summarizeArticle,
  generateOutline,
  getReflectionPrompts,
  changeTone,
  generateTags,
  customPrompt,
} from './ai'

describe('AI module (src/lib/ai.ts)', () => {
  const originalEnv = import.meta.env.VITE_GEMINI_API_KEY

  beforeEach(() => {
    vi.restoreAllMocks()
    import.meta.env.VITE_GEMINI_API_KEY = 'test-gemini-api-key'
  })

  afterEach(() => {
    import.meta.env.VITE_GEMINI_API_KEY = originalEnv
  })

  describe('trimContent helper', () => {
    it('returns content untouched when within limit', () => {
      const text = 'Short text within limit'
      expect(trimContent(text, 100)).toBe(text)
    })

    it('trims content and appends indicator when exceeding limit', () => {
      const text = 'A'.repeat(200)
      const result = trimContent(text, 50)
      expect(result).toBe('A'.repeat(50) + '...[trimmed]')
      expect(result.length).toBe(62)
    })
  })

  describe('callGemini', () => {
    it('throws error when API key is missing or empty', async () => {
      import.meta.env.VITE_GEMINI_API_KEY = ''
      await expect(callGemini('Hello')).rejects.toThrow('Gemini API key not configured')

      import.meta.env.VITE_GEMINI_API_KEY = '   '
      await expect(callGemini('Hello')).rejects.toThrow('Gemini API key not configured')
    })

    it('sends request to Gemini 2.0 Flash endpoint with x-goog-api-key header and NO query param', async () => {
      const captured = {
        url: '',
        headers: {} as Record<string, string>,
        body: null as {
          contents: Array<{ parts: Array<{ text: string }> }>
          generationConfig: { maxOutputTokens: number }
        } | null,
      }

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        captured.url = url.toString()
        captured.headers = init?.headers as Record<string, string>
        captured.body = JSON.parse(init?.body as string)

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Generated reflection content' }] },
                finishReason: 'STOP',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })

      const output = await callGemini('Write a poem', 250)

      expect(output).toBe('Generated reflection content')
      expect(captured.url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
      )
      expect(captured.url).not.toContain('?key=')
      expect(captured.headers['x-goog-api-key']).toBe('test-gemini-api-key')
      expect(captured.headers['Content-Type']).toBe('application/json')
      expect(captured.body?.contents[0]?.parts[0]?.text).toBe('Write a poem')
      expect(captured.body?.generationConfig?.maxOutputTokens).toBe(250)
    })

    it('dynamically resolves updated API keys across invocations', async () => {
      let capturedKey = ''

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const headers = init?.headers as Record<string, string>
        capturedKey = headers['x-goog-api-key']
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Response' }] },
                finishReason: 'STOP',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })

      import.meta.env.VITE_GEMINI_API_KEY = 'key-one'
      await callGemini('Test 1')
      expect(capturedKey).toBe('key-one')

      import.meta.env.VITE_GEMINI_API_KEY = 'key-two'
      await callGemini('Test 2')
      expect(capturedKey).toBe('key-two')
    })

    it('throws meaningful error message when HTTP response is not ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'Quota exceeded for project', code: 429 },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      )

      await expect(callGemini('Prompt')).rejects.toThrow('Quota exceeded for project')
    })

    it('throws descriptive error when prompt is blocked by safety filters', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            promptFeedback: {
              blockReason: 'SAFETY',
              safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'HIGH' }],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      await expect(callGemini('Hazardous prompt')).rejects.toThrow(
        'AI request blocked: prompt flagged for SAFETY'
      )
    })

    it('throws descriptive error when generation candidate is blocked for SAFETY', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'SAFETY',
                safetyRatings: [{ category: 'HARM_CATEGORY_HARASSMENT', probability: 'HIGH' }],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      await expect(callGemini('Prompt')).rejects.toThrow(
        'AI content generation blocked due to safety policies'
      )
    })

    it('throws descriptive error on unexpected finish reasons (e.g. RECITATION)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'RECITATION',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      await expect(callGemini('Prompt')).rejects.toThrow(
        'AI generation stopped unexpectedly (RECITATION)'
      )
    })

    it('accepts MAX_TOKENS finish reason when content parts exist', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Partial output that reached max limit' }] },
                finishReason: 'MAX_TOKENS',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      const res = await callGemini('Long response needed')
      expect(res).toBe('Partial output that reached max limit')
    })

    it('throws when candidate content text is empty or missing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ finishReason: 'STOP', content: { parts: [] } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      await expect(callGemini('Prompt')).rejects.toThrow('AI returned an empty response')
    })
  })

  describe('Writing assistant feature functions', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'faith, leadership, grace, community' }] },
                finishReason: 'STOP',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    })

    it('generateTags parses and formats tags array correctly', async () => {
      const tags = await generateTags('Title', 'Content')
      expect(tags).toEqual(['faith', 'leadership', 'grace', 'community'])
    })

    it('continueWriting formats appropriate prompt', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await continueWriting('First thoughts...')
      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts[0].text).toContain("Continue this piece naturally")
      expect(body.generationConfig.maxOutputTokens).toBe(400)
    })

    it('improveWriting formats editor prompt', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await improveWriting('Draft content')
      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts[0].text).toContain("You are an expert editor")
    })

    it('summarizeArticle asks for 2-sentence summary', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await summarizeArticle('Long article text')
      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts[0].text).toContain("Write a compelling 2-sentence summary")
    })

    it('generateOutline requests concise outline', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await generateOutline('Building in Public')
      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts[0].text).toContain("Create a concise article outline")
    })

    it('getReflectionPrompts requests 5 reflection questions', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await getReflectionPrompts('Spiritual disciplines')
      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts[0].text).toContain("Generate 5 thought-provoking reflection questions")
    })

    it('changeTone requests style adjustment for specific tone', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await changeTone('Raw notes', 'poetic')
      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts[0].text).toContain("Rewrite the following in a poetic tone")
    })

    it('customPrompt appends context only when provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await customPrompt('Explain the metaphor')
      let body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts[0].text).toBe('Explain the metaphor')

      await customPrompt('Explain the metaphor', 'Article body text')
      body = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)
      expect(body.contents[0].parts[0].text).toContain('Article context:\nArticle body text')
    })
  })
})
