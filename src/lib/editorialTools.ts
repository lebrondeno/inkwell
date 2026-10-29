import { escapeHtml } from './ai'

export interface ChecklistItem {
  text: string
  checked: boolean
}

/**
 * Creates a luxury editorial section divider (✦ ✦ ✦).
 */
export function createSectionDividerHtml(): string {
  return '<p class="inkwell-section-divider" style="text-align: center; letter-spacing: 0.6em; color: var(--accent); margin: 2em 0; font-size: 1.1em; user-select: none;">✦ ✦ ✦</p><p></p>'
}

/**
 * Creates an editorial pull quote with custom or default inspirational prose.
 */
export function createPullQuoteHtml(quoteText?: string): string {
  const clean = quoteText ? escapeHtml(quoteText.trim()) : 'A great thought speaks to the mind; a great conviction speaks to the soul.'
  return `<blockquote class="inkwell-pull-quote" style="border-left: 3px solid var(--accent); padding-left: 1.4em; margin: 1.6em 0; font-family: 'Playfair Display', Georgia, serif; font-size: 1.25em; font-style: italic; color: var(--text-primary);"><p>“${clean}”</p></blockquote><p></p>`
}

/**
 * Creates a drop cap paragraph for opening paragraphs.
 */
export function createDropCapHtml(firstLetter: string, rest?: string): string {
  const char = escapeHtml((firstLetter || 'O').slice(0, 1).toUpperCase())
  const body = rest ? escapeHtml(rest) : 'nce upon a time in the quiet stillness of the study...'
  return `<p><span class="inkwell-drop-cap" style="float: left; font-size: 3.2em; line-height: 0.8; padding: 4px 8px 2px 0; font-family: 'Playfair Display', Georgia, serif; font-weight: 700; color: var(--accent);">${char}</span>${body}</p><p></p>`
}

/**
 * Formats an official editorial dateline with the current date.
 */
export function createDatelineHtml(date = new Date(), studioName = 'Inkwell Writing Studio'): string {
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `<p class="inkwell-dateline" style="color: var(--text-muted); font-size: 0.9em; font-style: italic; margin-bottom: 1.2em;">— ${dateStr} · ${escapeHtml(studioName)}</p><p></p>`
}

/**
 * Creates a live word count & reading time badge in editorial prose.
 */
export function createWordCountBadgeHtml(words: number, readingTime?: number): string {
  const rTime = readingTime ?? Math.max(1, Math.ceil(words / 200))
  return `<p class="inkwell-word-badge" style="display: inline-block; padding: 3px 10px; border-radius: 100px; background: var(--bg-hover); border: 1px solid var(--border); font-size: 12px; font-family: 'DM Mono', monospace; color: var(--accent); margin: 0.8em 0;">✦ ${words} words · ${rTime} min read</p><p></p>`
}

/**
 * Builds TipTap-compatible TaskList HTML with interactive checkboxes.
 */
export function createChecklistHtml(items: ChecklistItem[]): string {
  if (!items.length) return ''
  const listItems = items.map(item => {
    const isChecked = Boolean(item.checked)
    const checkedAttr = isChecked ? ' checked="checked"' : ''
    return `<li data-type="taskItem" data-checked="${isChecked}"><label><input type="checkbox"${checkedAttr}><span></span></label><div><p>${escapeHtml(item.text)}</p></div></li>`
  }).join('')
  return `<ul data-type="taskList">${listItems}</ul>`
}

/**
 * Parses markdown checklist items: `- [ ] `, `- [x] `, `☐ `, `☑ `.
 */
export function parseChecklistItemsFromMarkdown(text: string): ChecklistItem[] {
  const lines = text.split(/\r?\n/)
  const result: ChecklistItem[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    const taskMatch = trimmed.match(/^[-*•]\s+\[([ xX])\]\s+(.+)$/)
    if (taskMatch) {
      result.push({
        checked: taskMatch[1].toLowerCase() === 'x',
        text: taskMatch[2].trim(),
      })
      continue
    }

    const symbolMatch = trimmed.match(/^([☐☑])\s+(.+)$/)
    if (symbolMatch) {
      result.push({
        checked: symbolMatch[1] === '☑',
        text: symbolMatch[2].trim(),
      })
    }
  }

  return result
}

/**
 * Toggles the nth task item checkbox state inside an HTML string.
 */
export function toggleCheckboxHtml(html: string, index: number): string {
  let currentIndex = 0
  return html.replace(/<li\s+data-type="taskItem"\s+data-checked="(true|false)"([\s\S]*?)<\/li>/gi, (match, checkedState, inner) => {
    if (currentIndex === index) {
      const willBeChecked = checkedState !== 'true'
      let updatedInner = inner
      if (willBeChecked) {
        if (!/<input[^>]+checked/i.test(updatedInner)) {
          updatedInner = updatedInner.replace(/<input\s+type="checkbox"/i, '<input type="checkbox" checked="checked"')
        }
      } else {
        updatedInner = updatedInner.replace(/\s*checked(="[^"]*")?/gi, '')
      }
      currentIndex++
      return `<li data-type="taskItem" data-checked="${willBeChecked}"${updatedInner}</li>`
    }
    currentIndex++
    return match
  })
}
