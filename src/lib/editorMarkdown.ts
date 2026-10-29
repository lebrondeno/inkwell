import { escapeHtml } from './ai'

/**
 * Editor markdown helpers.
 *
 * AI responses (and pasted drafts) frequently contain raw markdown such as
 * `# Heading`, `**bold**`, `- bullet`, or `- [ ] checklist`. These helpers
 * convert that markdown into the clean rich-text HTML understood by the TipTap editor.
 *
 * Heading mapping (the article title is already the page's H1):
 *   `# `   → <h2>
 *   `## `  → <h3>
 *   `### ` → <h3>
 */

const HEADING_RE = /^(#{1,3})\s+(.+)$/
const TASK_RE = /^[-*•]\s+\[([ xX])\]\s+(.+)$/
const CHECKBOX_SYMBOL_RE = /^([☐☑])\s+(.+)$/
const BULLET_RE = /^[-*•]\s+(.+)$/
const ORDERED_RE = /^\d+[.)]\s+(.+)$/
const HR_RE = /^(?:-{3,}|\*{3,}|_{3,})$/

/** Convert inline markdown emphasis (`**bold**`, `__bold__`, `*italic*`, `_italic_`). */
export function formatInlineMarkdown(html: string): string {
  return html
    .replace(/\*\*([^*<>\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_<>\n]+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s<>\n](?:[^*<>\n]*?[^*\s<>\n])?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s<>\n](?:[^_<>\n]*?[^_\s<>\n])?)_(?![_\w])/g, '$1<em>$2</em>')
}

/** Strip tags to inspect the visible text of a line. */
function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

/** Remove a leading markdown marker from an HTML line while keeping inner tags. */
function stripMarker(html: string, marker: RegExp): string {
  // Only strip from the leading visible text (markers are never inside tags).
  const leadingTags = html.match(/^(\s*(?:<[^>]+>\s*)*)/)?.[0] ?? ''
  const rest = html.slice(leadingTags.length)
  return leadingTags + rest.replace(marker, '')
}

/** Convert a group of lines (already HTML-safe) into block-level HTML. */
function linesToBlocks(lines: string[], paragraphAttrs = ''): string {
  const out: string[] = []
  let para: string[] = []
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null
  let taskList: Array<{ checked: boolean; text: string }> | null = null

  const flushPara = () => {
    if (para.length) {
      out.push(`<p${paragraphAttrs}>${formatInlineMarkdown(para.join('<br>'))}</p>`)
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      out.push(`<${list.type}>${list.items.map(i => `<li><p>${formatInlineMarkdown(i)}</p></li>`).join('')}</${list.type}>`)
      list = null
    }
  }
  const flushTaskList = () => {
    if (taskList) {
      out.push(
        `<ul data-type="taskList">${taskList
          .map(
            t =>
              `<li data-type="taskItem" data-checked="${t.checked}"><label><input type="checkbox"${
                t.checked ? ' checked="checked"' : ''
              }><span></span></label><div><p>${formatInlineMarkdown(t.text)}</p></div></li>`
          )
          .join('')}</ul>`
      )
      taskList = null
    }
  }

  for (const line of lines) {
    const text = visibleText(line)
    if (!text) { flushPara(); flushList(); flushTaskList(); continue }

    const heading = text.match(HEADING_RE)
    if (heading) {
      flushPara(); flushList(); flushTaskList()
      const tag = heading[1].length === 1 ? 'h2' : 'h3'
      out.push(`<${tag}>${formatInlineMarkdown(stripMarker(line, /^#{1,3}\s+/))}</${tag}>`)
      continue
    }
    if (HR_RE.test(text)) {
      flushPara(); flushList(); flushTaskList()
      out.push('<hr>')
      continue
    }

    const taskMatch = text.match(TASK_RE)
    const symbolMatch = !taskMatch && text.match(CHECKBOX_SYMBOL_RE)
    if (taskMatch || symbolMatch) {
      flushPara(); flushList()
      if (!taskList) taskList = []
      const checked = taskMatch ? taskMatch[1].toLowerCase() === 'x' : symbolMatch ? symbolMatch[1] === '☑' : false
      const rawItemText = stripMarker(
        line,
        taskMatch ? /^[-*•]\s+\[[ xX]\]\s+/ : /^[☐☑]\s+/
      )
      taskList.push({ checked, text: rawItemText })
      continue
    }

    const bullet = text.match(BULLET_RE)
    const ordered = !bullet && text.match(ORDERED_RE)
    if (bullet || ordered) {
      flushPara(); flushTaskList()
      const type = bullet ? 'ul' : 'ol'
      if (!list || list.type !== type) { flushList(); list = { type, items: [] } }
      list.items.push(stripMarker(line, bullet ? /^[-*•]\s+/ : /^\d+[.)]\s+/))
      continue
    }
    flushList(); flushTaskList()
    para.push(line)
  }
  flushPara(); flushList(); flushTaskList()
  return out.join('')
}

const BLOCK_MARKER_TEST = (text: string) =>
  HEADING_RE.test(text) ||
  BULLET_RE.test(text) ||
  ORDERED_RE.test(text) ||
  HR_RE.test(text) ||
  TASK_RE.test(text) ||
  CHECKBOX_SYMBOL_RE.test(text)

const INLINE_MARKER_TEST = (html: string) => formatInlineMarkdown(html) !== html

/**
 * Clean up raw markdown that lives inside existing editor HTML.
 * e.g. `<p># The Oligarchy</p>` → `<h2>The Oligarchy</h2>`.
 * Paragraphs with no markdown are left byte-for-byte untouched.
 */
export function formatMarkdownInHtml(html: string): string {
  if (!html) return html
  const withBlocks = html.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/g, (match, attrs: string | undefined, inner: string) => {
    const lines = inner.split(/<br\s*\/?>/i)
    const hasBlock = lines.some(l => BLOCK_MARKER_TEST(visibleText(l)))
    if (!hasBlock) {
      return INLINE_MARKER_TEST(inner) ? `<p${attrs ?? ''}>${formatInlineMarkdown(inner)}</p>` : match
    }
    return linesToBlocks(lines, attrs ?? '')
  })
  // Inline emphasis inside headings / list items that were already structured.
  return withBlocks.replace(/<(h[1-6]|li)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (_m, tag: string, attrs: string | undefined, inner: string) =>
    `<${tag}${attrs ?? ''}>${formatInlineMarkdown(inner)}</${tag}>`
  )
}

/** Returns true when the HTML contains raw markdown that `formatMarkdownInHtml` would clean. */
export function hasRawMarkdown(html: string): boolean {
  return !!html && formatMarkdownInHtml(html) !== html
}

/**
 * Convert a plain markdown string (e.g. an AI response) into safe editor HTML.
 * Input is HTML-escaped first, so it can never inject markup.
 */
export function markdownToHtml(markdown: string): string {
  const text = (markdown || '').replace(/\r\n?/g, '\n').trim()
  if (!text) return ''
  const escaped = escapeHtml(text)
  return escaped
    .split(/\n{2,}/)
    .map(block => linesToBlocks(block.split('\n')))
    .join('')
}
