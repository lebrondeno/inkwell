import { useEffect, useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, BackgroundColor, FontSize, LineHeight } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { useVisualViewport } from '../hooks/useVisualViewport'
import {
  createSectionDividerHtml,
  createPullQuoteHtml,
  createDropCapHtml,
  createDatelineHtml,
  createWordCountBadgeHtml,
} from '../lib/editorialTools'
import styles from './RichEditor.module.css'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

const IndentExtension = Extension.create({
  name: 'indent',
  addOptions() {
    return {
      types: ['paragraph', 'heading', 'blockquote'],
      minLevel: 0,
      maxLevel: 4,
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: element => parseInt(element.getAttribute('data-indent') || '0', 10) || 0,
            renderHTML: attributes => {
              if (!attributes.indent) return {}
              return {
                'data-indent': attributes.indent,
                style: `margin-left: ${attributes.indent * 24}px;`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          let changed = false
          tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentIndent = node.attrs.indent || 0
              if (currentIndent < this.options.maxLevel) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: currentIndent + 1,
                })
                changed = true
              }
            }
          })
          if (changed && dispatch) dispatch(tr)
          return changed
        },
      outdent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          let changed = false
          tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentIndent = node.attrs.indent || 0
              if (currentIndent > this.options.minLevel) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: currentIndent - 1,
                })
                changed = true
              }
            }
          })
          if (changed && dispatch) dispatch(tr)
          return changed
        },
    }
  },
})

const FONTS = [
  { label: 'Default',       value: '' },
  { label: 'Playfair',      value: "'Playfair Display', serif" },
  { label: 'DM Sans',       value: "'DM Sans', sans-serif" },
  { label: 'Georgia',       value: 'Georgia, serif' },
  { label: 'Garamond',      value: "'EB Garamond', Garamond, serif" },
  { label: 'Lato',          value: "'Lato', sans-serif" },
  { label: 'Courier',       value: "'Courier New', monospace" },
]

const WPS_FONT_PILLS = [
  { label: 'Editorial Serif (Playfair)', value: "'Playfair Display', serif" },
  { label: 'Clean Sans (Inter)',        value: "'DM Sans', sans-serif" },
  { label: 'Classic (Georgia)',         value: 'Georgia, serif' },
  { label: 'Monospace',                 value: "'Courier New', monospace" },
]

const FONT_SIZES = ['12', '14', '15', '16', '18', '20', '24', '28']

const TEXT_COLORS = [
  { label: 'Obsidian', color: '#18181b' },
  { label: 'Amber',    color: '#d97706' },
  { label: 'Crimson',  color: '#ef4444' },
  { label: 'Emerald',  color: '#10b981' },
  { label: 'Royal',    color: '#3b82f6' },
  { label: 'Purple',   color: '#8b5cf6' },
  { label: 'Bronze',   color: '#c9a96e' },
  { label: 'Muted',    color: '#71717a' },
]

const HIGHLIGHT_COLORS = [
  { label: 'Warm Gold', color: '#fef08a' },
  { label: 'Sage',      color: '#bbf7d0' },
  { label: 'Sky',       color: '#bae6fd' },
  { label: 'Rose',      color: '#fecdd3' },
  { label: 'Lavender',  color: '#e9d5ff' },
  { label: 'Peach',     color: '#fed7aa' },
]

const LINE_SPACINGS = [
  { label: '1.4',  value: '1.4' },
  { label: '1.75', value: '1.75' },
  { label: '2.0',  value: '2.0' },
]

interface Props {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  /** Format Markdown (# → Headings) helper */
  onFormatMarkdown?: () => void
  /** Highlights the markdown button when raw markdown is detected. */
  hasMarkdown?: boolean
  /** Opens the AI Assistant */
  onOpenAi?: () => void
  /** Word count for the editorial badge */
  wordCount?: number
  /** Estimated reading time */
  readingTime?: number
}

export default function RichEditor({
  content,
  onChange,
  placeholder,
  onFormatMarkdown,
  hasMarkdown,
  onOpenAi,
  wordCount = 0,
  readingTime = 1,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const colorBtnRef = useRef<HTMLButtonElement | null>(null)
  const highlightBtnRef = useRef<HTMLButtonElement | null>(null)

  const { keyboardOffset, isMobile } = useVisualViewport(wrapRef)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
        blockquote: {},
        code: {},
        codeBlock: {},
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      BackgroundColor,
      FontSize,
      LineHeight.configure({ types: ['heading', 'paragraph'] }),
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList.configure({
        HTMLAttributes: {
          class: styles.taskList,
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: styles.taskItem,
        },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: styles.link } }),
      Placeholder.configure({ placeholder: placeholder || 'Begin writing...' }),
      CharacterCount,
      IndentExtension,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: styles.proseMirror,
        spellcheck: 'true',
      },
    },
  })

  // Sync external content changes (e.g. when loading saved article)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (content !== current && content !== '<p></p>') {
      editor.commands.setContent(content, {
        parseOptions: {
          preserveWhitespace: false,
        },
      })
    }
  }, [content]) // eslint-disable-line

  // Close popovers on outside interaction or Escape
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (
        drawerRef.current?.contains(target) ||
        wrapRef.current?.contains(target)
      ) {
        return
      }
      setColorOpen(false)
      setHighlightOpen(false)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setColorOpen(false)
        setHighlightOpen(false)
        setDrawerOpen(false)
      }
    }

    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('Enter URL', prev || 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const handleIndent = useCallback(() => {
    if (!editor) return
    if (editor.isActive('listItem')) {
      editor.chain().focus().sinkListItem('listItem').run()
    } else if (editor.isActive('taskItem')) {
      editor.chain().focus().sinkListItem('taskItem').run()
    } else {
      editor.chain().focus().indent().run()
    }
  }, [editor])

  const handleOutdent = useCallback(() => {
    if (!editor) return
    if (editor.isActive('listItem')) {
      editor.chain().focus().liftListItem('listItem').run()
    } else if (editor.isActive('taskItem')) {
      editor.chain().focus().liftListItem('taskItem').run()
    } else {
      editor.chain().focus().outdent().run()
    }
  }, [editor])

  const cycleAlignment = useCallback(() => {
    if (!editor) return
    const current =
      editor.isActive({ textAlign: 'center' }) ? 'center' :
      editor.isActive({ textAlign: 'right' }) ? 'right' :
      editor.isActive({ textAlign: 'justify' }) ? 'justify' : 'left'
    const next =
      current === 'left' ? 'center' :
      current === 'center' ? 'right' :
      current === 'right' ? 'justify' : 'left'
    editor.chain().focus().setTextAlign(next).run()
  }, [editor])

  const toggleHighlight = useCallback((color = '#fef08a') => {
    if (!editor) return
    const current = editor.getAttributes('textStyle').backgroundColor
    if (current) {
      editor.chain().focus().unsetBackgroundColor().run()
    } else {
      editor.chain().focus().setBackgroundColor(color).run()
    }
  }, [editor])

  const handleDismissKeyboard = useCallback(() => {
    setDrawerOpen(false)
    setColorOpen(false)
    setHighlightOpen(false)
    if (editor) {
      editor.commands.blur()
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [editor])

  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.matches('input[type="checkbox"]') || target.closest('[data-type="taskItem"]')) {
      setTimeout(() => {
        if (editor) {
          onChange(editor.getHTML())
        }
      }, 30)
    }
  }, [editor, onChange])

  const insertDropCap = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const selected = editor.state.doc.textBetween(from, to, ' ').trim()
    if (selected) {
      const first = selected.charAt(0)
      const rest = selected.slice(1)
      editor.chain().focus().insertContent(createDropCapHtml(first, rest)).run()
    } else {
      editor.chain().focus().insertContent(createDropCapHtml('O')).run()
    }
  }, [editor])

  const insertPullQuote = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const selected = editor.state.doc.textBetween(from, to, ' ').trim()
    editor.chain().focus().insertContent(createPullQuoteHtml(selected || undefined)).run()
  }, [editor])

  const insertSectionDivider = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertContent(createSectionDividerHtml()).run()
  }, [editor])

  const insertDateline = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertContent(createDatelineHtml()).run()
  }, [editor])

  const insertWordCountBadge = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertContent(createWordCountBadgeHtml(wordCount, readingTime)).run()
  }, [editor, wordCount, readingTime])

  if (!editor) return null

  const currentColor: string = editor.getAttributes('textStyle').color || ''
  const currentHighlight: string = editor.getAttributes('textStyle').backgroundColor || ''
  const currentFontSize: string = (editor.getAttributes('textStyle').fontSize || '').replace('px', '')
  const currentFontFamily: string = editor.getAttributes('textStyle').fontFamily || ''
  const currentAlign: 'left' | 'center' | 'right' | 'justify' =
    editor.isActive({ textAlign: 'center' }) ? 'center' :
    editor.isActive({ textAlign: 'right' }) ? 'right' :
    editor.isActive({ textAlign: 'justify' }) ? 'justify' : 'left'

  const currentBlock =
    editor.isActive('heading', { level: 1 }) ? 'h1' :
    editor.isActive('heading', { level: 2 }) ? 'h2' :
    editor.isActive('heading', { level: 3 }) ? 'h3' :
    editor.isActive('blockquote') ? 'quote' :
    editor.isActive('codeBlock') ? 'codeBlock' : 'p'

  const btn = (
    active: boolean,
    onClick: () => void,
    title: string,
    label: React.ReactNode,
    extraClass = ''
  ) => (
    <button
      type="button"
      className={`${styles.toolBtn} ${active ? styles.active : ''} ${extraClass}`}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {label}
    </button>
  )

  const alignIcon =
    currentAlign === 'center' ? '↔' :
    currentAlign === 'right' ? '➡' :
    currentAlign === 'justify' ? '▤' : '⬅'

  // Render the WPS formatting drawer / multi-tool sheet
  const renderWpsDrawer = () => (
    <div
      ref={drawerRef}
      className={styles.wpsDrawer}
      role="region"
      aria-label="WPS All-in-One Formatting Drawer"
    >
      <div className={styles.drawerHeader}>
        <div className={styles.drawerTitle}>
          <span className={styles.drawerIcon}>Aa</span>
          <span>Typography &amp; Formatting</span>
        </div>
        <button
          type="button"
          className={styles.drawerCloseBtn}
          onMouseDown={e => e.preventDefault()}
          onClick={() => setDrawerOpen(false)}
        >
          ✕ Close
        </button>
      </div>

      <div className={styles.drawerBody}>
        {/* Font Size Pills */}
        <div className={styles.drawerSection}>
          <span className={styles.drawerLabel}>Font Size</span>
          <div className={styles.pillRow}>
            {FONT_SIZES.map(sz => (
              <button
                key={sz}
                type="button"
                className={`${styles.sizePill} ${currentFontSize === sz ? styles.sizePillActive : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  if (currentFontSize === sz) {
                    editor.chain().focus().unsetFontSize().run()
                  } else {
                    editor.chain().focus().setFontSize(`${sz}px`).run()
                  }
                }}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        {/* Font Family Pills */}
        <div className={styles.drawerSection}>
          <span className={styles.drawerLabel}>Font Family</span>
          <div className={styles.pillGrid}>
            {WPS_FONT_PILLS.map(font => (
              <button
                key={font.label}
                type="button"
                className={`${styles.fontPill} ${currentFontFamily === font.value ? styles.fontPillActive : ''}`}
                style={{ fontFamily: font.value }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  if (currentFontFamily === font.value) {
                    editor.chain().focus().unsetFontFamily().run()
                  } else {
                    editor.chain().focus().setFontFamily(font.value).run()
                  }
                }}
              >
                {font.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text Color Swatches */}
        <div className={styles.drawerSection}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.drawerLabel}>Text Ink Color</span>
            {currentColor && (
              <button
                type="button"
                className={styles.clearPill}
                onMouseDown={e => e.preventDefault()}
                onClick={() => editor.chain().focus().unsetColor().run()}
              >
                ✕ Clear
              </button>
            )}
          </div>
          <div className={styles.colorSwatchRow}>
            {TEXT_COLORS.map(c => (
              <button
                key={c.color}
                type="button"
                className={`${styles.swatchBtn} ${currentColor === c.color ? styles.swatchBtnActive : ''}`}
                style={{ background: c.color }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => editor.chain().focus().setColor(c.color).run()}
                title={c.label}
                aria-label={`Ink color ${c.label}`}
              />
            ))}
          </div>
        </div>

        {/* Highlighter Marker Swatches */}
        <div className={styles.drawerSection}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.drawerLabel}>Highlighter Marker</span>
            {currentHighlight && (
              <button
                type="button"
                className={styles.clearPill}
                onMouseDown={e => e.preventDefault()}
                onClick={() => editor.chain().focus().unsetBackgroundColor().run()}
              >
                ✕ Clear
              </button>
            )}
          </div>
          <div className={styles.colorSwatchRow}>
            {HIGHLIGHT_COLORS.map(h => (
              <button
                key={h.color}
                type="button"
                className={`${styles.swatchBtn} ${currentHighlight === h.color ? styles.swatchBtnActive : ''}`}
                style={{ background: h.color, border: '1px solid rgba(0,0,0,0.15)' }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => editor.chain().focus().setBackgroundColor(h.color).run()}
                title={h.label}
                aria-label={`Highlight ${h.label}`}
              />
            ))}
          </div>
        </div>

        {/* Paragraph & Spacing Controls */}
        <div className={styles.drawerSection}>
          <span className={styles.drawerLabel}>Paragraph &amp; Structure</span>
          <div className={styles.toolBtnGroup}>
            {btn(currentBlock === 'h1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1', 'H1')}
            {btn(currentBlock === 'h2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2', 'H2')}
            {btn(currentBlock === 'h3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3', 'H3')}
            {btn(currentBlock === 'p', () => editor.chain().focus().setParagraph().run(), 'Paragraph', 'Body')}
            {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Blockquote', '❝ Quote')}
            {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), 'Checklist', '☑ Task')}
            {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', '• Bullet')}
            {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', '1. Number')}
          </div>

          <div className={styles.subRow} style={{ marginTop: '8px' }}>
            <span className={styles.drawerSubLabel}>Alignment &amp; Indent</span>
            <div className={styles.toolBtnGroup}>
              {btn(currentAlign === 'left', () => editor.chain().focus().setTextAlign('left').run(), 'Left', '⬅')}
              {btn(currentAlign === 'center', () => editor.chain().focus().setTextAlign('center').run(), 'Center', '↔')}
              {btn(currentAlign === 'right', () => editor.chain().focus().setTextAlign('right').run(), 'Right', '➡')}
              {btn(currentAlign === 'justify', () => editor.chain().focus().setTextAlign('justify').run(), 'Justify', '▤')}
              {btn(false, handleOutdent, 'Outdent', '⇤')}
              {btn(false, handleIndent, 'Indent', '⇥')}
            </div>
          </div>

          <div className={styles.subRow} style={{ marginTop: '8px' }}>
            <span className={styles.drawerSubLabel}>Line Spacing</span>
            <div className={styles.pillRow}>
              {LINE_SPACINGS.map(ls => (
                <button
                  key={ls.value}
                  type="button"
                  className={styles.sizePill}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => editor.chain().focus().setLineHeight(ls.value).run()}
                >
                  {ls.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editorial Inserts */}
        <div className={styles.drawerSection}>
          <span className={styles.drawerLabel}>Editorial Inserts</span>
          <div className={styles.insertGrid}>
            <button
              type="button"
              className={styles.insertPill}
              onMouseDown={e => e.preventDefault()}
              onClick={insertDropCap}
            >
              <span>✦</span> Drop Cap (First Letter)
            </button>
            <button
              type="button"
              className={styles.insertPill}
              onMouseDown={e => e.preventDefault()}
              onClick={insertPullQuote}
            >
              <span>❝</span> Pull Quote Callout
            </button>
            <button
              type="button"
              className={styles.insertPill}
              onMouseDown={e => e.preventDefault()}
              onClick={insertSectionDivider}
            >
              <span>✦✦✦</span> Section Divider
            </button>
            <button
              type="button"
              className={styles.insertPill}
              onMouseDown={e => e.preventDefault()}
              onClick={insertDateline}
            >
              <span>📅</span> Timestamp / Dateline
            </button>
            <button
              type="button"
              className={styles.insertPill}
              onMouseDown={e => e.preventDefault()}
              onClick={insertWordCountBadge}
            >
              <span>🏷️</span> Word Count Badge
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.wrapper} ref={wrapRef}>
      {/* ── DESKTOP STICKY TOOLBAR (> 768px) ── */}
      {!isMobile && (
        <div className={styles.toolbarWrap}>
          <div className={styles.toolbar} role="toolbar" aria-label="Desktop Formatting">
            {/* Pinned Aa WPS Button */}
            <button
              type="button"
              className={`${styles.toolBtn} ${styles.wpsTrigger} ${drawerOpen ? styles.active : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => setDrawerOpen(o => !o)}
              title="WPS Typography & Formatting Drawer"
              aria-label="WPS Typography Drawer"
              aria-expanded={drawerOpen}
            >
              <span className={styles.wpsAa}>Aa</span>
              <span className={styles.wpsChevron}>▾</span>
            </button>

            <div className={styles.sep} />

            {/* Block format */}
            <select
              className={styles.select}
              value={currentBlock}
              onMouseDown={e => e.preventDefault()}
              onChange={e => {
                const v = e.target.value
                if (v === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run()
                else if (v === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run()
                else if (v === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run()
                else if (v === 'quote') editor.chain().focus().toggleBlockquote().run()
                else if (v === 'codeBlock') editor.chain().focus().toggleCodeBlock().run()
                else editor.chain().focus().setParagraph().run()
              }}
              title="Text style"
              aria-label="Text style"
            >
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="quote">Quote</option>
              <option value="codeBlock">Code Block</option>
            </select>

            {/* Font family */}
            <select
              className={styles.select}
              value={currentFontFamily}
              onMouseDown={e => e.preventDefault()}
              onChange={e => {
                if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run()
                else editor.chain().focus().unsetFontFamily().run()
              }}
              title="Font family"
              aria-label="Font family"
            >
              {FONTS.map(f => (
                <option key={f.label} value={f.value} style={{ fontFamily: f.value || 'inherit' }}>
                  {f.label === 'Default' ? 'Font' : f.label}
                </option>
              ))}
            </select>

            {/* Font size */}
            <select
              className={`${styles.select} ${styles.selectNarrow}`}
              value={currentFontSize || '16'}
              onMouseDown={e => e.preventDefault()}
              onChange={e => editor.chain().focus().setFontSize(`${e.target.value}px`).run()}
              title="Font size"
              aria-label="Font size"
            >
              {FONT_SIZES.map(sz => (
                <option key={sz} value={sz}>{sz}px</option>
              ))}
            </select>

            <div className={styles.sep} />

            {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold (Ctrl+B)', 'B', styles.bold)}
            {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic (Ctrl+I)', 'I', styles.italic)}
            {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline (Ctrl+U)', 'U', styles.underline)}
            {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough', 'S', styles.strike)}

            <div className={styles.sep} />

            {/* Checklist */}
            {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), 'Interactive Checklist (☑)', '☑')}
            {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list (•)', '•')}
            {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list (1.)', '1.')}
            {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Blockquote (❝)', '❝')}

            <div className={styles.sep} />

            {/* Alignment Cycle & Indent */}
            {btn(false, cycleAlignment, `Alignment (${currentAlign})`, alignIcon)}
            {btn(false, handleOutdent, 'Outdent (⇤)', '⇤')}
            {btn(false, handleIndent, 'Indent (⇥)', '⇥')}

            <div className={styles.sep} />

            {/* Text Color Trigger */}
            <div style={{ position: 'relative' }}>
              <button
                ref={colorBtnRef}
                type="button"
                className={`${styles.toolBtn} ${colorOpen ? styles.active : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setHighlightOpen(false); setColorOpen(o => !o) }}
                title="Text color"
                aria-label="Text color"
              >
                <span className={styles.colorIndicator}>
                  T
                  <span className={styles.colorBar} style={{ background: currentColor || 'var(--accent)' }} />
                </span>
              </button>

              {colorOpen && (
                <div className={styles.colorPopover} role="dialog" aria-label="Text color options">
                  <div className={styles.colorGrid}>
                    {TEXT_COLORS.map(c => (
                      <button
                        key={c.color}
                        type="button"
                        className={`${styles.colorBtn} ${currentColor === c.color ? styles.colorBtnActive : ''}`}
                        style={{ background: c.color }}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { editor.chain().focus().setColor(c.color).run(); setColorOpen(false) }}
                        title={c.label}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.colorReset}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { editor.chain().focus().unsetColor().run(); setColorOpen(false) }}
                  >
                    ✕ Clear color
                  </button>
                </div>
              )}
            </div>

            {/* Highlight Marker Trigger */}
            <div style={{ position: 'relative' }}>
              <button
                ref={highlightBtnRef}
                type="button"
                className={`${styles.toolBtn} ${currentHighlight ? styles.active : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setColorOpen(false); setHighlightOpen(o => !o) }}
                title="Highlight marker"
                aria-label="Text highlighter"
              >
                <span className={styles.highlightBadge} style={{ background: currentHighlight || 'rgba(254, 240, 138, 0.4)' }}>
                  [T]
                </span>
              </button>

              {highlightOpen && (
                <div className={styles.colorPopover} role="dialog" aria-label="Highlighter colors">
                  <div className={styles.colorGrid}>
                    {HIGHLIGHT_COLORS.map(h => (
                      <button
                        key={h.color}
                        type="button"
                        className={`${styles.colorBtn} ${currentHighlight === h.color ? styles.colorBtnActive : ''}`}
                        style={{ background: h.color }}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { editor.chain().focus().setBackgroundColor(h.color).run(); setHighlightOpen(false) }}
                        title={h.label}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.colorReset}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { editor.chain().focus().unsetBackgroundColor().run(); setHighlightOpen(false) }}
                  >
                    ✕ Remove highlight
                  </button>
                </div>
              )}
            </div>

            <div className={styles.sep} />

            {/* Links & Divider */}
            {btn(editor.isActive('link'), setLink, 'Insert link', '🔗')}
            {btn(false, () => editor.chain().focus().setHorizontalRule().run(), 'Horizontal divider', '—')}
            {btn(false, insertSectionDivider, 'Section divider (✦✦✦)', '✦✦✦')}
            {btn(false, () => editor.chain().focus().unsetAllMarks().clearNodes().run(), 'Clear formatting', '🧹')}

            {onFormatMarkdown && (
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.mdBtn} ${hasMarkdown ? styles.mdBtnAlert : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={onFormatMarkdown}
                title="Format Markdown (# → Headings)"
              >
                #→H
              </button>
            )}

            <div className={styles.sep} />

            {onOpenAi && (
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.aiBtn}`}
                onMouseDown={e => e.preventDefault()}
                onClick={onOpenAi}
                title="AI Co-pilot"
              >
                ✦ AI
              </button>
            )}

            {btn(false, () => editor.chain().focus().undo().run(), 'Undo (Ctrl+Z)', '↶')}
            {btn(false, () => editor.chain().focus().redo().run(), 'Redo (Ctrl+Y)', '↷')}
          </div>

          {drawerOpen && renderWpsDrawer()}
        </div>
      )}

      {/* ── MOBILE SAMSUNG NOTES / WPS KEYBOARD DOCK (<= 768px) ── */}
      {isMobile && (
        <div
          className={styles.mobileDockContainer}
          style={{ bottom: `${keyboardOffset}px` }}
        >
          {drawerOpen && renderWpsDrawer()}

          <div className={styles.mobileDockBar} role="toolbar" aria-label="Mobile Keyboard Formatting Dock">
            {/* a) Pinned Left Trigger: Aa WPS Panel Button */}
            <button
              type="button"
              className={`${styles.dockPinnedLeft} ${drawerOpen ? styles.dockAaActive : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => setDrawerOpen(o => !o)}
              title="WPS Typography Drawer"
              aria-label="WPS Formatting Drawer"
              aria-expanded={drawerOpen}
            >
              <span className={styles.wpsAa}>Aa</span>
            </button>

            {/* b) Horizontally Scrollable Quick Editorial Strip */}
            <div className={styles.dockScrollStrip}>
              {/* Checklist */}
              {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), 'Checklist', '☑')}

              {/* Text Color quick trigger */}
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.dockToolBtn}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  const next =
                    !currentColor ? TEXT_COLORS[1].color :
                    currentColor === TEXT_COLORS[1].color ? TEXT_COLORS[2].color :
                    currentColor === TEXT_COLORS[2].color ? TEXT_COLORS[3].color :
                    ''
                  if (next) editor.chain().focus().setColor(next).run()
                  else editor.chain().focus().unsetColor().run()
                }}
                title="Cycle text color"
              >
                <span className={styles.colorIndicator}>
                  T
                  <span className={styles.colorBar} style={{ background: currentColor || 'var(--accent)' }} />
                </span>
              </button>

              {/* Highlight Color marker */}
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.dockToolBtn} ${currentHighlight ? styles.active : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => toggleHighlight()}
                title="Highlight marker"
              >
                <span className={styles.highlightBadge} style={{ background: currentHighlight || 'rgba(254, 240, 138, 0.45)' }}>
                  [T]
                </span>
              </button>

              {/* Heading / Style dropdown */}
              <select
                className={`${styles.select} ${styles.dockSelect}`}
                value={currentBlock}
                onMouseDown={e => e.preventDefault()}
                onChange={e => {
                  const v = e.target.value
                  if (v === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run()
                  else if (v === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run()
                  else if (v === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run()
                  else if (v === 'quote') editor.chain().focus().toggleBlockquote().run()
                  else if (v === 'codeBlock') editor.chain().focus().toggleCodeBlock().run()
                  else editor.chain().focus().setParagraph().run()
                }}
                title="Heading / Style"
              >
                <option value="p">Body</option>
                <option value="h1">H1</option>
                <option value="h2">H2</option>
                <option value="h3">H3</option>
                <option value="quote">Quote</option>
                <option value="codeBlock">Code</option>
              </select>

              {/* Font Size select */}
              <select
                className={`${styles.select} ${styles.dockSelectNarrow}`}
                value={currentFontSize || '16'}
                onMouseDown={e => e.preventDefault()}
                onChange={e => editor.chain().focus().setFontSize(`${e.target.value}px`).run()}
                title="Font size"
              >
                {FONT_SIZES.map(sz => (
                  <option key={sz} value={sz}>{sz}</option>
                ))}
              </select>

              {/* B, I, U, S */}
              {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', 'B', styles.bold)}
              {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', 'I', styles.italic)}
              {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline', 'U', styles.underline)}
              {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough', 'S', styles.strike)}

              {/* Lists & Quote */}
              {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet', '•')}
              {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered', '1.')}
              {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote', '❝')}

              {/* Outdent & Indent */}
              {btn(false, handleOutdent, 'Outdent', '⇤')}
              {btn(false, handleIndent, 'Indent', '⇥')}

              {/* Alignment cycle */}
              {btn(false, cycleAlignment, `Alignment (${currentAlign})`, alignIcon)}

              {/* Link, HR, Clear Formatting, Format Markdown */}
              {btn(editor.isActive('link'), setLink, 'Link', '🔗')}
              {btn(false, () => editor.chain().focus().setHorizontalRule().run(), 'HR', '—')}
              {btn(false, () => editor.chain().focus().unsetAllMarks().clearNodes().run(), 'Clear formatting', '🧹')}

              {onFormatMarkdown && (
                <button
                  type="button"
                  className={`${styles.toolBtn} ${styles.dockToolBtn} ${hasMarkdown ? styles.mdBtnAlert : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={onFormatMarkdown}
                  title="Format Markdown (# → Headings)"
                >
                  #→H
                </button>
              )}

              {/* AI Co-Pilot */}
              {onOpenAi && (
                <button
                  type="button"
                  className={`${styles.toolBtn} ${styles.dockToolBtn} ${styles.aiBtn}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={onOpenAi}
                  title="AI Co-pilot"
                >
                  ✦ AI
                </button>
              )}

              {/* Undo / Redo */}
              {btn(false, () => editor.chain().focus().undo().run(), 'Undo', '↶')}
              {btn(false, () => editor.chain().focus().redo().run(), 'Redo', '↷')}
            </div>

            {/* c) Pinned Right Button: ⌨↓ / ✓ */}
            <button
              type="button"
              className={styles.dockPinnedRight}
              onMouseDown={e => e.preventDefault()}
              onClick={handleDismissKeyboard}
              title={drawerOpen ? 'Done' : 'Dismiss keyboard'}
              aria-label={drawerOpen ? 'Done' : 'Dismiss keyboard'}
            >
              {drawerOpen ? '✓' : '⌨↓'}
            </button>
          </div>
        </div>
      )}

      {/* ── EDITOR BODY (ProseMirror) ── */}
      <div onClick={handleEditorClick}>
        <EditorContent editor={editor} className={styles.editorBody} />
      </div>
    </div>
  )
}
