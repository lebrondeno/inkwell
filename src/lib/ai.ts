export const DEFAULT_MAX_CHARS = 1500
export const ARTICLE_TOO_LONG_MSG = '⚠️ This article is too long to rewrite as a whole.'
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'
export const FALLBACK_GEMINI_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_RETRY_DELAYS = [1500, 3000]

// Trim content to avoid sending huge prompts — keeps API usage low
export function trimContent(text: string, maxChars = DEFAULT_MAX_CHARS): string {
  if (text.length <= maxChars) return text
  return text.substring(0, maxChars) + '...[trimmed]'
}

// Tail-trim helper to send the end of the article for continuation prompts
export function trimTail(text: string, maxChars = DEFAULT_MAX_CHARS): string {
  if (text.length <= maxChars) return text
  return '...[trimmed]' + text.slice(-maxChars)
}
export const trimContentTail = trimTail

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatAiErrorMessage(msg: string): string {
  return msg === 'Gemini API key not configured'
    ? '⚠️ Add VITE_GEMINI_API_KEY to your .env file.'
    : `⚠️ ${msg}`
}

export function formatAiInsertion(action: string, currentContent: string, rawResult: string): string {
  const escaped = escapeHtml(rawResult)
  if (action === 'continue') {
    return (currentContent || '') + '<p>' + escaped.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>'
  }
  if (['improve', 'tone'].includes(action)) {
    return escaped.split('\n\n').filter(Boolean).map(p => `<p>${p}</p>`).join('')
  }
  return currentContent
}

export interface CallGeminiOptions {
  allowTruncated?: boolean
  retryDelays?: number[]
}

export async function callGemini(
  prompt: string,
  maxTokens = 500,
  options?: CallGeminiOptions
): Promise<string> {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || ''
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }

  const primaryModel =
    (import.meta.env.VITE_GEMINI_MODEL as string | undefined)?.trim() || DEFAULT_GEMINI_MODEL

  const executeRequest = async (model: string, includeThinking: boolean) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const generationConfig: Record<string, unknown> = {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
      topP: 0.9,
    }
    if (includeThinking) {
      generationConfig.thinkingConfig = {
        thinkingLevel: 'minimal',
      }
    }

    const doFetch = () =>
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
      })

    try {
      return await doFetch()
    } catch (err) {
      const isTransient =
        err instanceof TypeError || (err instanceof Error && /fetch|network/i.test(err.message))

      if (isTransient) {
        await new Promise(resolve => setTimeout(resolve, 800))
        try {
          return await doFetch()
        } catch (retryErr) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            throw new Error('Network disconnected. Please check your internet connection and try again.')
          }
          throw retryErr
        }
      }
      throw err
    }
  }

  let currentModel = primaryModel
  let currentIncludeThinking = true

  let res = await executeRequest(currentModel, currentIncludeThinking)

  // 1. Auto-handle HTTP 400 (if model rejects thinkingConfig)
  if (!res.ok && res.status === 400) {
    const err = await res.json().catch(() => ({}))
    const msg = (err?.error?.message as string) || ''
    if (/thinking/i.test(msg)) {
      currentIncludeThinking = false
      res = await executeRequest(currentModel, currentIncludeThinking)
    }
  }

  // 2. Auto-handle HTTP 404 (model retired / not found)
  if (!res.ok && res.status === 404 && currentModel !== FALLBACK_GEMINI_MODEL) {
    currentModel = FALLBACK_GEMINI_MODEL
    currentIncludeThinking = true
    res = await executeRequest(currentModel, currentIncludeThinking)
    if (!res.ok && res.status === 400) {
      const fbErr = await res.json().catch(() => ({}))
      const fbMsg = (fbErr?.error?.message as string) || ''
      if (/thinking/i.test(fbMsg)) {
        currentIncludeThinking = false
        res = await executeRequest(currentModel, currentIncludeThinking)
      }
    }
  }

  // 3. Retry with exponential backoff on 429 (rate limit) or 503 (temporary outage / busy)
  const retryDelays = options?.retryDelays ?? DEFAULT_RETRY_DELAYS
  if (!res.ok && (res.status === 429 || res.status === 503)) {
    for (const delay of retryDelays) {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      res = await executeRequest(currentModel, currentIncludeThinking)
      if (res.ok) {
        break
      }
      // If 400 thinking error occurs on retry, handle it
      if (res.status === 400 && currentIncludeThinking) {
        const retryErr = await res.json().catch(() => ({}))
        const retryMsg = (retryErr?.error?.message as string) || ''
        if (/thinking/i.test(retryMsg)) {
          currentIncludeThinking = false
          res = await executeRequest(currentModel, currentIncludeThinking)
          if (res.ok) break
        }
      }
      if (res.status !== 429 && res.status !== 503) {
        break
      }
    }
  }

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Rate limit reached. Please wait a moment before trying again.')
    }
    if (res.status === 503) {
      throw new Error('Gemini service is temporarily busy. Retrying...')
    }
    const err = await res.json().catch(() => ({}))
    const msg = err?.error?.message || `AI request failed with status ${res.status}`
    throw new Error(msg)
  }

  const data = await res.json()

  // Prompt-level block feedback (e.g., prompt violates safety guidelines)
  if (data?.promptFeedback?.blockReason) {
    throw new Error(`AI request blocked: prompt flagged for ${data.promptFeedback.blockReason}`)
  }

  const candidate = data?.candidates?.[0]
  if (!candidate) {
    throw new Error('No response generated by AI')
  }

  // Candidate safety block
  if (candidate.finishReason === 'SAFETY') {
    throw new Error('AI content generation blocked due to safety policies')
  }

  // Check truncation: throw unless allowTruncated is explicitly enabled
  if (candidate.finishReason === 'MAX_TOKENS') {
    if (!options?.allowTruncated) {
      throw new Error('AI generation reached token limit and was truncated')
    }
  } else if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`AI generation stopped unexpectedly (${candidate.finishReason})`)
  }

  const text = candidate.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('AI returned an empty response')
  }

  return text
}

export async function continueWriting(content: string): Promise<string> {
  return callGemini(
    `You are a thoughtful writing assistant. Continue this piece naturally, matching the author's voice. Write 2 short paragraphs only. Return only the continuation, no preamble:\n\n${trimTail(content)}`,
    400,
    { allowTruncated: true }
  )
}

export async function improveWriting(content: string): Promise<string> {
  return callGemini(
    `You are an expert editor. Rewrite the following to be more powerful and clear while preserving the author's voice. Return only the improved text:\n\n${trimContent(content)}`,
    500
  )
}

export async function summarizeArticle(content: string): Promise<string> {
  return callGemini(
    `Write a compelling 2-sentence summary of this article:\n\n${trimContent(content)}`,
    150
  )
}

export async function generateOutline(topic: string): Promise<string> {
  return callGemini(
    `Create a concise article outline for: "${trimContent(topic, 300)}". Include a title and 4 main sections with one-line descriptions each.`,
    300,
    { allowTruncated: true }
  )
}

export async function getReflectionPrompts(topic: string): Promise<string> {
  return callGemini(
    `Generate 5 thought-provoking reflection questions about: "${trimContent(topic, 200) || 'life and personal growth'}". Number them 1-5.`,
    300,
    { allowTruncated: true }
  )
}

export async function changeTone(content: string, tone: string): Promise<string> {
  return callGemini(
    `Rewrite the following in a ${tone} tone. Preserve all ideas but adjust the style. Return only the rewritten text:\n\n${trimContent(content)}`,
    500
  )
}

export async function generateTags(title: string, content: string): Promise<string[]> {
  const result = await callGemini(
    `Suggest 4-5 relevant tags for this article. Return only a comma-separated list, nothing else.\n\nTitle: ${trimContent(title, 100)}\nContent: ${trimContent(content, 400)}`,
    60
  )
  return result.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 5)
}

// Free-form custom prompt — optionally includes article context
export async function customPrompt(userPrompt: string, articleContent?: string): Promise<string> {
  const context = articleContent
    ? `\n\nArticle context:\n${trimContent(articleContent, 800)}`
    : ''
  return callGemini(`${userPrompt}${context}`, 500, { allowTruncated: true })
}
