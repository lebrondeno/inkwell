const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`

// Trim content to avoid sending huge prompts — keeps API usage low
function trimContent(text: string, maxChars = 1500): string {
  if (text.length <= maxChars) return text
  return text.substring(0, maxChars) + '...[trimmed]'
}

async function callGemini(prompt: string, maxTokens = 500): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured')

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        topP: 0.9,
      }
    })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'AI request failed')
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function continueWriting(content: string): Promise<string> {
  return callGemini(
    `You are a thoughtful writing assistant. Continue this piece naturally, matching the author's voice. Write 2 short paragraphs only. Return only the continuation, no preamble:\n\n${trimContent(content)}`,
    400
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
    300
  )
}

export async function getReflectionPrompts(topic: string): Promise<string> {
  return callGemini(
    `Generate 5 thought-provoking reflection questions about: "${trimContent(topic, 200) || 'life and personal growth'}". Number them 1-5.`,
    300
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
  return callGemini(`${userPrompt}${context}`, 500)
}
