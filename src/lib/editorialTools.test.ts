import { describe, it, expect } from 'vitest'
import {
  createSectionDividerHtml,
  createPullQuoteHtml,
  createDropCapHtml,
  createDatelineHtml,
  createWordCountBadgeHtml,
  createChecklistHtml,
  parseChecklistItemsFromMarkdown,
  toggleCheckboxHtml,
} from './editorialTools'

describe('editorialTools', () => {
  it('creates section divider with ✦ ✦ ✦', () => {
    const divider = createSectionDividerHtml()
    expect(divider).toContain('✦ ✦ ✦')
    expect(divider).toContain('inkwell-section-divider')
  })

  it('creates pull quote with escaped text', () => {
    const quote = createPullQuoteHtml('Faith & Knowledge')
    expect(quote).toContain('Faith &amp; Knowledge')
    expect(quote).toContain('inkwell-pull-quote')
  })

  it('creates drop cap for first letter', () => {
    const dropCap = createDropCapHtml('w', 'hen the morning came...')
    expect(dropCap).toContain('inkwell-drop-cap')
    expect(dropCap).toContain('>W</span>')
    expect(dropCap).toContain('hen the morning came...')
  })

  it('creates formatted dateline', () => {
    const date = new Date(2026, 9, 29)
    const dateline = createDatelineHtml(date, 'Patmos Studio')
    expect(dateline).toContain('October 29, 2026')
    expect(dateline).toContain('Patmos Studio')
  })

  it('creates word count badge with reading time', () => {
    const badge = createWordCountBadgeHtml(450, 3)
    expect(badge).toContain('450 words')
    expect(badge).toContain('3 min read')
  })

  it('creates TipTap taskList html from items', () => {
    const items = [
      { text: 'First point', checked: false },
      { text: 'Second point', checked: true },
    ]
    const html = createChecklistHtml(items)
    expect(html).toContain('<ul data-type="taskList">')
    expect(html).toContain('data-type="taskItem" data-checked="false"')
    expect(html).toContain('data-type="taskItem" data-checked="true"')
    expect(html).toContain('checked="checked"')
    expect(html).toContain('First point')
    expect(html).toContain('Second point')
  })

  it('parses markdown checklist items with checkboxes and symbols', () => {
    const md = `
- [ ] Sermon intro
- [x] Scripture reading
☐ Hymn singing
☑ Final benediction
- Normal bullet item
`
    const items = parseChecklistItemsFromMarkdown(md)
    expect(items).toHaveLength(4)
    expect(items[0]).toEqual({ text: 'Sermon intro', checked: false })
    expect(items[1]).toEqual({ text: 'Scripture reading', checked: true })
    expect(items[2]).toEqual({ text: 'Hymn singing', checked: false })
    expect(items[3]).toEqual({ text: 'Final benediction', checked: true })
  })

  it('toggles checkbox state in HTML', () => {
    const initial = '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Task 1</p></div></li></ul>'
    const toggled = toggleCheckboxHtml(initial, 0)
    expect(toggled).toContain('data-checked="true"')
    expect(toggled).toContain('checked="checked"')

    const untoggled = toggleCheckboxHtml(toggled, 0)
    expect(untoggled).toContain('data-checked="false"')
    expect(untoggled).not.toContain('checked="checked"')
  })
})
