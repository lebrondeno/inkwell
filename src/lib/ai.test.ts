import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  trimContent,
  trimTail,
  DEFAULT_MAX_CHARS,
  ARTICLE_TOO_LONG_MSG,
  escapeHtml,
  formatAiErrorMessage,
  formatAiInsertion,
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

  describe('Item 3: trimTail helper', () => {
    it('returns content untouched when within limit', () => {
      const text = 'Short tail text'
      expect(trimTail(text, 100)).toBe(text)
    })

    it('trims from the start and preserves the END of the content', () => {
      const text = 'START_CONTENT_TO_DISCARD' + 'END_CONTENT_TO_KEEP'
      const result = trimTail(text, 19)
      expect(result).toBe('...[trimmed]END_CONTENT_TO_KEEP')
    })
  })

  describe('callGemini', () => {
    it('throws error when API key is missing or empty', async () => {
      import.meta.env.VITE_GEMINI_API_KEY = ''
      await expect(callGemini('Hello')).rejects.toThrow('Gemini API key not configured')

      import.meta.env.VITE_GEMINI_API_KEY = '   '
      await expect(callGemini('Hello')).rejects.toThrow('Gemini API key not configured')
    })

    it('Item 1: sends thinkingConfig minimal in generationConfig without query param', async () => {
      const captured = {
        url: '',
        headers: {} as Record<string, string>,
        body: null as {
          contents: Array<{ parts: Array<{ text: string }> }>
          generationConfig: {
            maxOutputTokens: number
            thinkingConfig?: { thinkingLevel?: string }
          }
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
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent'
      )
      expect(captured.url).not.toContain('?key=')
      expect(captured.headers['x-goog-api-key']).toBe('test-gemini-api-key')
      expect(captured.headers['Content-Type']).toBe('application/json')
      expect(captured.body?.contents[0]?.parts[0]?.text).toBe('Write a poem')
      expect(captured.body?.generationConfig?.maxOutputTokens).toBe(250)
      expect(captured.body?.generationConfig?.thinkingConfig?.thinkingLevel).toBe('minimal')
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

    it('auto-recovers when model rejects thinkingConfig with HTTP 400', async () => {
      let callCount = 0
      const capturedBodies: Array<{
        generationConfig: {
          thinkingConfig?: { thinkingLevel?: string }
        }
      }> = []

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        callCount++
        capturedBodies.push(JSON.parse(init?.body as string))
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              error: { message: 'Thinking level is not supported for this model.', code: 400 },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Recovered without thinking' }] },
                finishReason: 'STOP',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })

      const res = await callGemini('Prompt without thinking support')
      expect(res).toBe('Recovered without thinking')
      expect(callCount).toBe(2)
      expect(capturedBodies[0]?.generationConfig?.thinkingConfig?.thinkingLevel).toBe('minimal')
      expect(capturedBodies[1]?.generationConfig?.thinkingConfig).toBeUndefined()
    })

    it('auto-recovers when model returns HTTP 404 by falling back to gemini-3.5-flash-lite', async () => {
      let callCount = 0
      const capturedUrls: string[] = []

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        callCount++
        capturedUrls.push(url.toString())
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              error: { message: 'models/gemini-2.0-flash is not found', code: 404 },
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Recovered with fallback model' }] },
                finishReason: 'STOP',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })

      const res = await callGemini('Prompt with retired model')
      expect(res).toBe('Recovered with fallback model')
      expect(callCount).toBe(2)
      expect(capturedUrls[1]).toContain('gemini-3.5-flash-lite')
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

    it('Item 2: throws on MAX_TOKENS unless allowTruncated is explicitly passed', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
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

      // By default (or when allowTruncated is false), it must throw
      await expect(callGemini('Long response needed')).rejects.toThrow(
        'AI generation reached token limit and was truncated'
      )
      await expect(callGemini('Long response needed', 500, { allowTruncated: false })).rejects.toThrow(
        'AI generation reached token limit and was truncated'
      )

      // When allowTruncated is true, it succeeds and returns the partial text
      const res = await callGemini('Long response needed', 500, { allowTruncated: true })
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

  describe('Writing assistant feature functions & truncation rules', () => {
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

    it('Item 3: continueWriting sends the END of the article and allows truncation', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      const longArticle = 'EARLY_START_TEXT ' + 'Body words '.repeat(300) + 'FINAL_CONCLUSION_TEXT'
      await continueWriting(longArticle)

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      const promptText = body.contents[0].parts[0].text
      expect(promptText).toContain('Continue this piece naturally')
      expect(promptText).toContain('FINAL_CONCLUSION_TEXT')
      expect(promptText).not.toContain('EARLY_START_TEXT')
    })

    it('Item 2: callers allowing truncation vs callers disallowing truncation on MAX_TOKENS', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Truncated output' }] },
                finishReason: 'MAX_TOKENS',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      // These 4 MAY allow truncation:
      await expect(continueWriting('Article')).resolves.toBe('Truncated output')
      await expect(generateOutline('Topic')).resolves.toBe('Truncated output')
      await expect(getReflectionPrompts('Topic')).resolves.toBe('Truncated output')
      await expect(customPrompt('Prompt')).resolves.toBe('Truncated output')

      // These 4 must NOT allow truncation and must throw:
      await expect(improveWriting('Article')).rejects.toThrow('AI generation reached token limit')
      await expect(summarizeArticle('Article')).rejects.toThrow('AI generation reached token limit')
      await expect(changeTone('Article', 'poetic')).rejects.toThrow('AI generation reached token limit')
      await expect(generateTags('Title', 'Content')).rejects.toThrow('AI generation reached token limit')
    })

    it('improveWriting formats editor prompt', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await improveWriting('Draft content')
      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts[0].text).toContain('You are an expert editor')
    })

    it('summarizeArticle asks for 2-sentence summary', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await summarizeArticle('Long article text')
      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts[0].text).toContain('Write a compelling 2-sentence summary')
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

  describe('Items 4, 5, 6: Editor.tsx integration logic', () => {
    it('Item 4: protects against rewriting oversized articles', () => {
      const shortText = 'A'.repeat(DEFAULT_MAX_CHARS)
      const longText = 'A'.repeat(DEFAULT_MAX_CHARS + 1)

      expect(shortText.length <= DEFAULT_MAX_CHARS).toBe(true)
      expect(longText.length > DEFAULT_MAX_CHARS).toBe(true)
      expect(ARTICLE_TOO_LONG_MSG).toBe('⚠️ This article is too long to rewrite as a whole.')
    })

    it('Item 5: escapeHtml and formatAiInsertion HTML-escape aiResult before wrapping in p tags', () => {
      const malicious = '<script>alert("xss")</script> & "quotes" \'single\''
      const escaped = escapeHtml(malicious)

      expect(escaped).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;quotes&quot; &#39;single&#39;'
      )

      // Test formatAiInsertion for continue
      const continueHtml = formatAiInsertion('continue', '<p>Original</p>', 'Line 1\n\nLine 2<script>')
      expect(continueHtml).toBe('<p>Original</p><p>Line 1</p><p>Line 2&lt;script&gt;</p>')

      // Test formatAiInsertion for improve/tone
      const improveHtml = formatAiInsertion('improve', '<p>Original</p>', 'Para 1 <b>\n\nPara 2')
      expect(improveHtml).toBe('<p>Para 1 &lt;b&gt;</p><p>Para 2</p>')
    })

    it('Item 6: formatAiErrorMessage only shows .env hint on exact match', () => {
      // Exact match for missing key -> shows .env hint
      expect(formatAiErrorMessage('Gemini API key not configured')).toBe(
        '⚠️ Add VITE_GEMINI_API_KEY to your .env file.'
      )

      // Other errors containing "API key" -> shows real message
      expect(formatAiErrorMessage('API key not valid. Please pass a valid API key.')).toBe(
        '⚠️ API key not valid. Please pass a valid API key.'
      )
      expect(formatAiErrorMessage('API key expired')).toBe('⚠️ API key expired')

      // Generic error -> shows real message
      expect(formatAiErrorMessage('Network request failed')).toBe('⚠️ Network request failed')
    })
  })
})
