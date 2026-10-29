import { describe, it, expect } from 'vitest'
import { markdownToHtml, formatMarkdownInHtml, formatInlineMarkdown, hasRawMarkdown } from './editorMarkdown'

describe('formatInlineMarkdown', () => {
  it('converts bold and italic', () => {
    expect(formatInlineMarkdown('a **b** c *d*')).toBe('a <strong>b</strong> c <em>d</em>')
  })
  it('leaves snake_case and lone asterisks alone', () => {
    expect(formatInlineMarkdown('my_var_name and 2 * 3')).toBe('my_var_name and 2 * 3')
  })
})

describe('markdownToHtml', () => {
  it('maps # to h2 and ## to h3', () => {
    expect(markdownToHtml('# Title\n\n## Sub')).toBe('<h2>Title</h2><h3>Sub</h3>')
  })
  it('wraps paragraphs and inline emphasis', () => {
    expect(markdownToHtml('Hello **world**\n\nSecond *para*')).toBe(
      '<p>Hello <strong>world</strong></p><p>Second <em>para</em></p>'
    )
  })
  it('handles a heading directly followed by text', () => {
    expect(markdownToHtml('# The Oligarchy\nOnce upon a time')).toBe('<h2>The Oligarchy</h2><p>Once upon a time</p>')
  })
  it('builds bullet and ordered lists', () => {
    expect(markdownToHtml('- one\n- two')).toBe('<ul><li><p>one</p></li><li><p>two</p></li></ul>')
    expect(markdownToHtml('1. one\n2. two')).toBe('<ol><li><p>one</p></li><li><p>two</p></li></ol>')
  })
  it('builds interactive task lists from - [ ] and symbols', () => {
    const html = markdownToHtml('- [ ] Prep sermon\n- [x] Read chapter\n☐ Write intro\n☑ Final prayer')
    expect(html).toContain('<ul data-type="taskList">')
    expect(html).toContain('data-type="taskItem" data-checked="false"')
    expect(html).toContain('data-type="taskItem" data-checked="true"')
    expect(html).toContain('checked="checked"')
    expect(html).toContain('Prep sermon')
    expect(html).toContain('Read chapter')
    expect(html).toContain('Write intro')
    expect(html).toContain('Final prayer')
  })
  it('escapes HTML to prevent injection', () => {
    const out = markdownToHtml('<script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })
  it('returns empty string for empty input', () => {
    expect(markdownToHtml('   ')).toBe('')
  })
})

describe('formatMarkdownInHtml', () => {
  it('turns raw markdown headings in paragraphs into headings', () => {
    expect(formatMarkdownInHtml('<p># The Oligarchy</p><p>Body</p>')).toBe('<h2>The Oligarchy</h2><p>Body</p>')
  })
  it('splits <br>-joined markdown lines', () => {
    expect(formatMarkdownInHtml('<p>## Part One<br>It began.</p>')).toBe('<h3>Part One</h3><p>It began.</p>')
  })
  it('leaves clean HTML untouched', () => {
    const html = '<h2>Clean</h2><p style="text-align: center">Nothing <strong>to</strong> do</p>'
    expect(formatMarkdownInHtml(html)).toBe(html)
    expect(hasRawMarkdown(html)).toBe(false)
  })
  it('converts inline emphasis inside existing paragraphs', () => {
    expect(formatMarkdownInHtml('<p>So **bold**</p>')).toBe('<p>So <strong>bold</strong></p>')
    expect(hasRawMarkdown('<p>So **bold**</p>')).toBe(true)
  })
})
