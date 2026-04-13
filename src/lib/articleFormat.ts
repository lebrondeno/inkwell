function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeHref(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
  } catch {
    // no-op
  }
  return '#'
}

function formatInline(text: string): string {
  let formatted = escapeHtml(text)

  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>')
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safe = safeHref(href)
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/==([^=]+)==/g, '<u>$1</u>')
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  return formatted
}

export function renderArticleContent(content: string): string {
  const lines = content.split('\n')
  const html: string[] = []
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>')
      inUl = false
    }
    if (inOl) {
      html.push('</ol>')
      inOl = false
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      closeLists()
      html.push('<div class="article-spacer"></div>')
      continue
    }

    if (line.startsWith('### ')) {
      closeLists()
      html.push(`<h3>${formatInline(line.slice(4))}</h3>`)
      continue
    }
    if (line.startsWith('## ')) {
      closeLists()
      html.push(`<h2>${formatInline(line.slice(3))}</h2>`)
      continue
    }
    if (line.startsWith('# ')) {
      closeLists()
      html.push(`<h1>${formatInline(line.slice(2))}</h1>`)
      continue
    }
    if (line.startsWith('> ')) {
      closeLists()
      html.push(`<blockquote>${formatInline(line.slice(2))}</blockquote>`)
      continue
    }
    if (line.startsWith('- ')) {
      if (inOl) {
        html.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        html.push('<ul>')
        inUl = true
      }
      html.push(`<li>${formatInline(line.slice(2))}</li>`)
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      if (inUl) {
        html.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        html.push('<ol>')
        inOl = true
      }
      html.push(`<li>${formatInline(line.replace(/^\d+\.\s/, ''))}</li>`)
      continue
    }

    closeLists()
    html.push(`<p class="article-paragraph">${formatInline(line)}</p>`)
  }

  closeLists()
  return html.join('')
}

