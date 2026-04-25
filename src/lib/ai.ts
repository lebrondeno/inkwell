// ============================================================
// ai.ts — Multi-provider LLM with automatic fallback
// Providers tried in order: Groq → Cerebras → OpenRouter
//
// Add to your .env:
//   VITE_GROQ_API_KEY=your_groq_key
//   VITE_CEREBRAS_API_KEY=your_cerebras_key
//   VITE_OPENROUTER_API_KEY=your_openrouter_key
//
// Get free keys (no credit card):
//   Groq:       https://console.groq.com
//   Cerebras:   https://inference.cerebras.ai
//   OpenRouter: https://openrouter.ai
// ============================================================

// ── Provider config ─────────────────────────────────────────

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const CEREBRAS_API_KEY = import.meta.env.VITE_CEREBRAS_API_KEY || ''
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || ''

const PROVIDERS = [
  {
    name: 'Groq',
    key: GROQ_API_KEY,
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    }),
  },
  {
    name: 'Cerebras',
    key: CEREBRAS_API_KEY,
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.3-70b',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    }),
  },
  {
    name: 'OpenRouter',
    key: OPENROUTER_API_KEY,
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Inkwell',
    }),
  },
]

// ── Request queue — prevents hammering multiple requests at once ──

let isProcessing = false
const queue: Array<() => Promise<void>> = []

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        resolve(await task())
      } catch (err) {
        reject(err)
      }
    })
    if (!isProcessing) processQueue()
  })
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return
  isProcessing = true
  while (queue.length > 0) {
    const next = queue.shift()!
    await next()
    // Small pause between requests to be gentle on rate limits
    if (queue.length > 0) await delay(300)
  }
  isProcessing = false
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Core call with fallback ──────────────────────────────────

async function callAI(prompt: string, maxTokens = 500): Promise<string> {
  const available = PROVIDERS.filter(p => p.key)

  if (available.length === 0) {
    throw new Error(
      'No AI API keys configured. Add at least one of: VITE_GROQ_API_KEY, VITE_CEREBRAS_API_KEY, VITE_OPENROUTER_API_KEY to your .env'
    )
  }

  for (const provider of available) {
    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: provider.headers(provider.key),
        body: JSON.stringify({
          model: provider.model,
          max_tokens: maxTokens,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = err?.error?.message || `HTTP ${res.status}`
        // 429 = rate limit — try next provider silently
        if (res.status === 429) {
          console.warn(`[Inkwell AI] ${provider.name} rate limited, trying next provider...`)
          continue
        }
        throw new Error(`${provider.name}: ${msg}`)
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || ''
      if (!text) continue // empty response — try next
      return text

    } catch (err: any) {
      // Network error or non-429 error — try next provider
      if (err.message?.includes('rate limit') || err.message?.includes('429')) {
        console.warn(`[Inkwell AI] ${provider.name} rate limited, trying next...`)
        continue
      }
      console.warn(`[Inkwell AI] ${provider.name} failed:`, err.message)
      // Only continue to next provider if it's a provider-side error
      if (available.indexOf(provider) < available.length - 1) continue
      throw err
    }
  }

  throw new Error('All AI providers are currently unavailable or rate limited. Please try again in a moment.')
}

// Queued wrapper — all public functions go through this
function queuedCall(prompt: string, maxTokens = 500): Promise<string> {
  return enqueue(() => callAI(prompt, maxTokens))
}

// ── Helpers ──────────────────────────────────────────────────

function trimContent(text: string, maxChars = 1500): string {
  if (text.length <= maxChars) return text
  return text.substring(0, maxChars) + '...[trimmed]'
}

// ── Public API — same interface as before ────────────────────

export async function continueWriting(content: string): Promise<string> {
  return queuedCall(
    `You are a thoughtful writing assistant. Continue this piece naturally, matching the author's voice. Write 2 short paragraphs only. Return only the continuation, no preamble:\n\n${trimContent(content)}`,
    400
  )
}

export async function improveWriting(content: string): Promise<string> {
  return queuedCall(
    `You are an expert editor. Rewrite the following to be more powerful and clear while preserving the author's voice. Return only the improved text:\n\n${trimContent(content)}`,
    500
  )
}

export async function summarizeArticle(content: string): Promise<string> {
  return queuedCall(
    `Write a compelling 2-sentence summary of this article:\n\n${trimContent(content)}`,
    150
  )
}

export async function generateOutline(topic: string): Promise<string> {
  return queuedCall(
    `Create a concise article outline for: "${trimContent(topic, 300)}". Include a title and 4 main sections with one-line descriptions each.`,
    300
  )
}

export async function getReflectionPrompts(topic: string): Promise<string> {
  return queuedCall(
    `Generate 5 thought-provoking reflection questions about: "${trimContent(topic, 200) || 'life and personal growth'}". Number them 1-5.`,
    300
  )
}

export async function changeTone(content: string, tone: string): Promise<string> {
  return queuedCall(
    `Rewrite the following in a ${tone} tone. Preserve all ideas but adjust the style. Return only the rewritten text:\n\n${trimContent(content)}`,
    500
  )
}

export async function generateTags(title: string, content: string): Promise<string[]> {
  const result = await queuedCall(
    `Suggest 4-5 relevant tags for this article. Return only a comma-separated list, nothing else.\n\nTitle: ${trimContent(title, 100)}\nContent: ${trimContent(content, 400)}`,
    60
  )
  return result.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 5)
}

export async function customPrompt(userPrompt: string, articleContent?: string): Promise<string> {
  const context = articleContent
    ? `\n\nArticle context:\n${trimContent(articleContent, 800)}`
    : ''
  return queuedCall(`${userPrompt}${context}`, 500)
}