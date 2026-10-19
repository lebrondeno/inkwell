import { describe, it, expect } from 'vitest'
import { renderArticleContent } from './articleFormat'

describe('renderArticleContent', () => {
  it('renders headings at all three levels', () => {
    expect(renderArticleContent('# H1')).toBe('<h1>H1</h1>')
    expect(renderArticleContent('## H2')).toBe('<h2>H2</h2>')
    expect(renderArticleContent('### H3')).toBe('<h3>H3</h3>')
  })

  it('escapes HTML in plain text to prevent injection', () => {
    const result = renderArticleContent('<script>alert(1)</script>')
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })

  it('renders a safe http link and strips unsafe protocols', () => {
    const safe = renderArticleContent('[click](https://example.com)')
    expect(safe).toContain('href="https://example.com/"')

    const unsafe = renderArticleContent('[click](javascript:alert(1))')
    expect(unsafe).toContain('href="#"')
    expect(unsafe).not.toContain('javascript:')
  })

  it('groups consecutive bullet lines into one ul, closing on blank line', () => {
    const result = renderArticleContent('- one\n- two\n\n- three')
    const ulCount = (result.match(/<ul>/g) || []).length
    expect(ulCount).toBe(2)
  })

  it('switches from unordered to ordered list without leaking a stray closing tag', () => {
    const result = renderArticleContent('- bullet\n1. numbered')
    expect(result).toContain('</ul>')
    expect(result).toContain('<ol>')
    expect(result.indexOf('</ul>')).toBeLessThan(result.indexOf('<ol>'))
  })

  it('applies bold, italic, underline, and code formatting inline', () => {
    const result = renderArticleContent('**bold** *italic* ==underline== `code`')
    expect(result).toContain('<strong>bold</strong>')
    expect(result).toContain('<em>italic</em>')
    expect(result).toContain('<u>underline</u>')
    expect(result).toContain('<code>code</code>')
  })
})
