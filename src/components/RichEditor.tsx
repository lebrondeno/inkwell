import { useEffect, useCallback } from 'react'
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
}

export default function RichEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
        blockquote: {},
        code: {},
        codeBlock: false,
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
      editor.commands.setContent(content, false)
    }
  }, [content]) // eslint-disable-line

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url  = window.prompt('Enter URL', prev || 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  const btn = (active: boolean, onClick: () => void, title: string, label: string) => (
    <button
      type="button"
      className={`${styles.toolBtn} ${active ? styles.active : ''}`}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  )

  return (
    <div className={styles.wrapper}>
      {/* Formatting toolbar */}
      <div className={styles.toolbar}>
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
        >
          {FONTS.map(f => (
            <option key={f.label} value={f.value} style={{ fontFamily: f.value || 'inherit' }}>
              {f.label}
            </option>
          ))}
        </select>

        <div className={styles.sep} />

        {btn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),      'Bold (Ctrl+B)',      'B')}
        {btn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),    'Italic (Ctrl+I)',    'I')}
        {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline (Ctrl+U)', 'U')}
        {btn(editor.isActive('strike'),    () => editor.chain().focus().toggleStrike().run(),    'Strikethrough',      'S̶')}

        <div className={styles.sep} />

        {/* Text align */}
        {btn(editor.isActive({ textAlign: 'left' }),    () => editor.chain().focus().setTextAlign('left').run(),    'Align left',    '⬅')}
        {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), 'Align center',  '↔')}
        {btn(editor.isActive({ textAlign: 'right' }),  () => editor.chain().focus().setTextAlign('right').run(),  'Align right',   '➡')}

        <div className={styles.sep} />

        {/* Lists */}
        {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  'Bullet list',    '•')}
        {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list',  '1.')}
        {btn(editor.isActive('blockquote'),  () => editor.chain().focus().toggleBlockquote().run(),  'Blockquote',     '❝')}

        <div className={styles.sep} />

        {/* Link */}
        {btn(editor.isActive('link'), setLink, 'Insert link', '🔗')}

        <div className={styles.sep} />

        {/* Text color */}
        <div className={styles.colorGroup}>
          <span className={styles.colorLabel} title="Text color">A</span>
          {COLORS.map(color => (
            <button
              key={color}
              type="button"
              className={styles.colorBtn}
              style={{ background: color, border: editor.isActive('textStyle', { color }) ? '2px solid var(--accent)' : '1px solid var(--border)' }}
              onClick={() => editor.chain().focus().setColor(color).run()}
              title={color}
            />
          ))}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => editor.chain().focus().unsetColor().run()}
            title="Clear color"
          >✕</button>
        </div>

        <div className={styles.sep} />

        {/* Undo/redo */}
        {btn(false, () => editor.chain().focus().undo().run(), 'Undo (Ctrl+Z)', '↩')}
        {btn(false, () => editor.chain().focus().redo().run(), 'Redo (Ctrl+Y)', '↪')}
      </div>

      {/* Editor body */}
      <EditorContent editor={editor} className={styles.editorBody} />
    </div>
  )
}
