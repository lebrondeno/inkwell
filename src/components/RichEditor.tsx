import { useEffect, useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import styles from './RichEditor.module.css'

const FONTS = [
  { label: 'Default',       value: '' },
  { label: 'Playfair',      value: "'Playfair Display', serif" },
  { label: 'DM Sans',       value: "'DM Sans', sans-serif" },
  { label: 'Georgia',       value: 'Georgia, serif' },
  { label: 'Garamond',      value: "'EB Garamond', Garamond, serif" },
  { label: 'Lato',          value: "'Lato', sans-serif" },
  { label: 'Courier',       value: "'Courier New', monospace" },
]

const COLORS = ['#e8e6e0','#c9a96e','#5ce08a','#6eb5ff','#e05c5c','#b06ef5','#f5a623','#ffffff','#888888','#333333']

interface Props {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  /** Optional: show a "# → H" toolbar button that cleans raw markdown in the document. */
  onFormatMarkdown?: () => void
  /** Highlights the markdown button when raw markdown is detected. */
  hasMarkdown?: boolean
}

export default function RichEditor({ content, onChange, placeholder, onFormatMarkdown, hasMarkdown }: Props) {
  const [colorOpen, setColorOpen] = useState(false)
  const [popoverLeft, setPopoverLeft] = useState(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const colorBtnRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
        blockquote: {},
        code: {},
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: styles.link } }),
      Placeholder.configure({ placeholder: placeholder || 'Begin writing...' }),
      CharacterCount,
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

  // Close the color popover on outside click / Escape / toolbar scroll
  useEffect(() => {
    if (!colorOpen) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (popoverRef.current?.contains(t) || colorBtnRef.current?.contains(t)) return
      setColorOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setColorOpen(false) }
    const onScroll = () => setColorOpen(false)
    const toolbar = toolbarRef.current
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    toolbar?.addEventListener('scroll', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      toolbar?.removeEventListener('scroll', onScroll)
    }
  }, [colorOpen])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url  = window.prompt('Enter URL', prev || 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const toggleColorPopover = () => {
    if (!colorOpen && colorBtnRef.current && wrapRef.current) {
      const btn = colorBtnRef.current.getBoundingClientRect()
      const wrap = wrapRef.current.getBoundingClientRect()
      const POPOVER_W = 196
      const left = Math.min(Math.max(btn.left - wrap.left + btn.width / 2 - POPOVER_W / 2, 4), Math.max(wrap.width - POPOVER_W - 4, 4))
      setPopoverLeft(left)
    }
    setColorOpen(o => !o)
  }

  if (!editor) return null

  const btn = (active: boolean, onClick: () => void, title: string, label: string, extraClass = '') => (
    <button
      type="button"
      className={`${styles.toolBtn} ${active ? styles.active : ''} ${extraClass}`}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {label}
    </button>
  )

  const currentColor: string | undefined = editor.getAttributes('textStyle').color
  const currentAlign = editor.isActive({ textAlign: 'center' }) ? 'center' : editor.isActive({ textAlign: 'right' }) ? 'right' : 'left'

  return (
    <div className={styles.wrapper}>
      {/* Sticky glass formatting toolbar */}
      <div className={styles.toolbarWrap} ref={wrapRef}>
        <div className={styles.toolbar} ref={toolbarRef} role="toolbar" aria-label="Formatting">
          {/* Block format */}
          <select
            className={styles.select}
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1' :
              editor.isActive('heading', { level: 2 }) ? 'h2' :
              editor.isActive('heading', { level: 3 }) ? 'h3' :
              editor.isActive('blockquote') ? 'quote' : 'p'
            }
            onChange={e => {
              const v = e.target.value
              if (v === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run()
              else if (v === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run()
              else if (v === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run()
              else if (v === 'quote') editor.chain().focus().toggleBlockquote().run()
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
          </select>

          {/* Font family */}
          <select
            className={styles.select}
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={e => {
              if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run()
              else editor.chain().focus().unsetFontFamily().run()
            }}
            title="Font"
            aria-label="Font"
          >
            {FONTS.map(f => (
              <option key={f.label} value={f.value} style={{ fontFamily: f.value || 'inherit' }}>
                {f.label === 'Default' ? 'Font' : f.label}
              </option>
            ))}
          </select>

          {/* Text align (compact) */}
          <select
            className={`${styles.select} ${styles.selectNarrow}`}
            value={currentAlign}
            onChange={e => editor.chain().focus().setTextAlign(e.target.value).run()}
            title="Alignment"
            aria-label="Alignment"
          >
            <option value="left">⬅ Left</option>
            <option value="center">↔ Center</option>
            <option value="right">➡ Right</option>
          </select>

          <div className={styles.sep} />

          {btn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),      'Bold (Ctrl+B)',      'B', styles.bold)}
          {btn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),    'Italic (Ctrl+I)',    'I', styles.italic)}
          {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline (Ctrl+U)', 'U', styles.underline)}
          {btn(editor.isActive('strike'),    () => editor.chain().focus().toggleStrike().run(),    'Strikethrough',      'S', styles.strike)}

          <div className={styles.sep} />

          {btn(editor.isActive('blockquote'),  () => editor.chain().focus().toggleBlockquote().run(),  'Blockquote',      '❝')}
          {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  'Bullet list',     '•')}
          {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list',   '1.')}
          {btn(editor.isActive('link'), setLink, 'Insert link', '🔗')}
          {btn(false, () => editor.chain().focus().setHorizontalRule().run(), 'Horizontal divider', '—')}

          <div className={styles.sep} />

          {/* Text color popover trigger */}
          <button
            ref={colorBtnRef}
            type="button"
            className={`${styles.toolBtn} ${colorOpen ? styles.active : ''}`}
            onClick={toggleColorPopover}
            title="Text color"
            aria-label="Text color"
            aria-haspopup="true"
            aria-expanded={colorOpen}
          >
            <span className={styles.colorIndicator}>
              A
              <span className={styles.colorBar} style={{ background: currentColor || 'var(--accent)' }} />
            </span>
          </button>
          {btn(false, () => editor.chain().focus().unsetColor().run(), 'Clear color', '✕', styles.clearColor)}

          <div className={styles.sep} />

          {btn(false, () => editor.chain().focus().undo().run(), 'Undo (Ctrl+Z)', '↶')}
          {btn(false, () => editor.chain().focus().redo().run(), 'Redo (Ctrl+Y)', '↷')}

          {onFormatMarkdown && (
            <>
              <div className={styles.sep} />
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.mdBtn} ${hasMarkdown ? styles.mdBtnAlert : ''}`}
                onClick={onFormatMarkdown}
                title="Format Markdown (# → Headings, **bold**, *italic*, lists)"
                aria-label="Format Markdown"
              >
                # → H
              </button>
            </>
          )}
        </div>

        {colorOpen && (
          <div ref={popoverRef} className={styles.colorPopover} style={{ left: popoverLeft }} role="dialog" aria-label="Text color swatches">
            <div className={styles.colorGrid}>
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`${styles.colorBtn} ${editor.isActive('textStyle', { color }) ? styles.colorBtnActive : ''}`}
                  style={{ background: color }}
                  onClick={() => { editor.chain().focus().setColor(color).run(); setColorOpen(false) }}
                  title={color}
                  aria-label={`Text color ${color}`}
                />
              ))}
            </div>
            <button
              type="button"
              className={styles.colorReset}
              onClick={() => { editor.chain().focus().unsetColor().run(); setColorOpen(false) }}
            >
              ✕ Clear color
            </button>
          </div>
        )}
      </div>

      {/* Editor body */}
      <EditorContent editor={editor} className={styles.editorBody} />
    </div>
  )
}
