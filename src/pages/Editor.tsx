import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import PublishModal from '../components/PublishModal'
import {
  continueWriting, improveWriting, summarizeArticle,
  generateOutline, getReflectionPrompts, changeTone, generateTags, customPrompt
} from '../lib/ai'
import type { Article } from '../lib/supabase'
import styles from './Editor.module.css'

const EMOJIS = ['✦', '✍️', '🕯️', '🌿', '🔥', '💡', '🌊', '⚡', '🎯', '📖', '🌙', '☀️', '🦋', '🌸', '⭐']
const TONES = ['formal', 'casual', 'poetic', 'devotional', 'academic', 'journalistic']
const WRITING_FONTS = [
  { id: 'playfair', label: 'Playfair', css: "'Playfair Display', serif" },
  { id: 'lora', label: 'Lora', css: "'Lora', serif" },
  { id: 'merriweather', label: 'Merriweather', css: "'Merriweather', serif" },
  { id: 'source-serif', label: 'Source Serif', css: "'Source Serif 4', serif" },
  { id: 'calibri', label: 'Calibri', css: "Calibri, 'Segoe UI', sans-serif" },
  { id: 'arial', label: 'Arial', css: "Arial, Helvetica, sans-serif" },
  { id: 'georgia', label: 'Georgia', css: "Georgia, serif" },
  { id: 'times', label: 'Times New Roman', css: "'Times New Roman', Times, serif" },
  { id: 'courier', label: 'Courier New', css: "'Courier New', Courier, monospace" },
]

export default function Editor() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, showToast } = useApp()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [article, setArticle] = useState<Partial<Article>>({
    title: '',
    content: location.state?.prompt ? `Prompt: ${location.state.prompt}\n\n` : '',
    status: 'draft',
    tags: [],
    cover_emoji: '✦',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [aiPanel, setAiPanel] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiAction, setAiAction] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [bibleVerseInput, setBibleVerseInput] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [readingTime, setReadingTime] = useState(0)
  const [selectedTone, setSelectedTone] = useState('formal')
  const [customPromptText, setCustomPromptText] = useState('')
  const [useArticleContext, setUseArticleContext] = useState(true)
  const [titleFont, setTitleFont] = useState(() => localStorage.getItem('title_font') || 'playfair')
  const [bodyFont, setBodyFont] = useState(() => localStorage.getItem('body_font') || 'playfair')

  useEffect(() => {
    if (id) loadArticle(id)
  }, [id])

  useEffect(() => {
    const words = article.content?.trim().split(/\s+/).filter(Boolean).length || 0
    setWordCount(words)
    setReadingTime(Math.ceil(words / 200))
  }, [article.content])

  useEffect(() => {
    localStorage.setItem('title_font', titleFont)
  }, [titleFont])

  useEffect(() => {
    localStorage.setItem('body_font', bodyFont)
  }, [bodyFont])

  useEffect(() => {
    if (!saved) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => autoSave(), 1500) as unknown as ReturnType<typeof setTimeout>
    }
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [article, saved])

  const loadArticle = async (articleId: string) => {
    const { data } = await supabase.from('articles').select('*').eq('id', articleId).single()
    if (data) {
      setArticle(data)
      setTagInput(data.tags?.join(', ') || '')
      setBibleVerseInput(data.bible_verse || '')
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const autoSave = useCallback(async () => {
    if (!article.title && !article.content) return
    setSaving(true)
    const payload = {
      ...article,
      user_id: user?.id,
      word_count: wordCount,
      reading_time: readingTime,
      updated_at: new Date().toISOString(),
    }
    if (article.id) {
      await supabase.from('articles').update(payload).eq('id', article.id)
    } else {
      const slug = (article.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
      const { data } = await supabase.from('articles').insert({ ...payload, slug }).select().single()
      if (data) {
        setArticle(prev => ({ ...prev, id: data.id, slug: data.slug }))
        navigate(`/app/write/${data.id}`, { replace: true })
      }
    }
    setSaving(false)
    setSaved(true)
  }, [article, user?.id, wordCount, readingTime])

  const handleChange = (field: string, value: any) => {
    setArticle(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleTagsChange = (val: string) => {
    setTagInput(val)
    const tags = val.split(',').map(t => t.trim()).filter(Boolean)
    handleChange('tags', tags)
  }

  const applyInlineFormat = (prefix: string, suffix = prefix, placeholder = 'text') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const current = article.content || ''
    const selected = current.slice(start, end) || placeholder
    const replacement = `${prefix}${selected}${suffix}`
    const updated = current.slice(0, start) + replacement + current.slice(end)

    handleChange('content', updated)
    requestAnimationFrame(() => {
      textarea.focus()
      const caret = start + replacement.length
      textarea.setSelectionRange(caret, caret)
    })
  }

  const applyLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const current = article.content || ''
    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const lineStart = current.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const lineEndBreak = current.indexOf('\n', end)
    const lineEnd = lineEndBreak === -1 ? current.length : lineEndBreak
    const selectedLines = current.slice(lineStart, lineEnd)
    const prefixed = selectedLines
      .split('\n')
      .map(line => (line.trim() ? `${prefix}${line}` : line))
      .join('\n')

    const updated = current.slice(0, lineStart) + prefixed + current.slice(lineEnd)
    handleChange('content', updated)

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(lineStart, lineStart + prefixed.length)
    })
  }

  const insertLink = () => {
    const url = window.prompt('Enter link URL (https://...)')
    if (!url) return
    applyInlineFormat('[', `](${url})`, 'link text')
  }

  const runAI = async (action: string) => {
    setAiAction(action)
    setAiLoading(true)
    setAiResult('')
    setAiPanel(true)
    try {
      let result = ''
      const content = article.content || ''
      const title = article.title || ''

      switch(action) {
        case 'continue': result = await continueWriting(content); break
        case 'improve': result = await improveWriting(content); break
        case 'summarize': result = await summarizeArticle(content); break
        case 'outline': result = await generateOutline(title || content); break
        case 'prompts': result = await getReflectionPrompts(title); break
        case 'tone': result = await changeTone(content, selectedTone); break
        case 'custom': result = await customPrompt(customPromptText, useArticleContext ? content : undefined); break
        case 'tags': {
          const tags = await generateTags(title, content)
          setTagInput(tags.join(', '))
          handleChange('tags', tags)
          result = `Suggested tags: ${tags.join(', ')}`
          break
        }
      }
      setAiResult(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('API key') || msg.includes('key not configured')) {
        setAiResult('⚠️ Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.')
      } else {
        setAiResult(`⚠️ Error: ${msg}`)
      }
    } finally {
      setAiLoading(false)
    }
  }

  const applyAIResult = () => {
    if (aiAction === 'continue') {
      handleChange('content', (article.content || '') + '\n\n' + aiResult)
    } else if (['improve', 'tone'].includes(aiAction)) {
      handleChange('content', aiResult)
    }
    setAiPanel(false)
    setAiResult('')
    showToast('AI suggestion applied')
  }

  const publish = async () => {
    if (!article.title?.trim()) {
      showToast('Please add a title before publishing', 'error')
      return
    }
    if (!article.content?.trim()) {
      showToast('Please write some content before publishing', 'error')
      return
    }

    // Build final payload with status = 'published' directly (avoid state race condition)
    setSaving(true)
    const payload = {
      ...article,
      status: 'published',
      user_id: user?.id,
      word_count: wordCount,
      reading_time: readingTime,
      updated_at: new Date().toISOString(),
    }

    let finalSlug = article.slug
    if (article.id) {
      await supabase.from('articles').update(payload).eq('id', article.id)
    } else {
      finalSlug = (article.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
      const { data } = await supabase.from('articles').insert({ ...payload, slug: finalSlug }).select().single()
      if (data) {
        setArticle(prev => ({ ...prev, id: data.id, slug: data.slug, status: 'published' }))
        finalSlug = data.slug
        navigate(`/app/write/${data.id}`, { replace: true })
      }
    }

    setArticle(prev => ({ ...prev, status: 'published', slug: finalSlug || prev.slug }))
    setSaving(false)
    setSaved(true)
    setShowPublishModal(true)
  }

  const statusColor = article.status === 'published' ? 'var(--green)' : article.status === 'archived' ? 'var(--red)' : 'var(--text-muted)'
  const titleFontFamily = WRITING_FONTS.find(f => f.id === titleFont)?.css || "'Playfair Display', serif"
  const bodyFontFamily = WRITING_FONTS.find(f => f.id === bodyFont)?.css || "'Playfair Display', serif"

  return (
    <div className={`${styles.wrapper} ${focusMode ? styles.focusMode : ''}`}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={`${styles.toolBtn}`} onClick={() => navigate('/app/articles')}>
            ← Back
          </button>
          <div className={styles.separator} />
          <span className={styles.statusDot} style={{ color: statusColor }}>●</span>
          <select
            value={article.status}
            onChange={e => handleChange('status', e.target.value)}
            className={styles.statusSelect}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className={styles.toolbarCenter}>
          <span className={styles.wordCount}>{wordCount} words · {readingTime} min read</span>
          <span className={styles.saveIndicator}>
            {saving ? '◌ Saving...' : saved ? '✓ Saved' : '● Unsaved'}
          </span>
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.fontGroup}>
            <label className={styles.fontLabel} htmlFor="title-font-select">Title</label>
            <select
              id="title-font-select"
              className={styles.fontSelect}
              value={titleFont}
              onChange={e => setTitleFont(e.target.value)}
              title="Change title font"
            >
              {WRITING_FONTS.map(font => (
                <option key={font.id} value={font.id}>{font.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.fontGroup}>
            <label className={styles.fontLabel} htmlFor="body-font-select">Body</label>
            <select
              id="body-font-select"
              className={styles.fontSelect}
              value={bodyFont}
              onChange={e => setBodyFont(e.target.value)}
              title="Change body font"
            >
              {WRITING_FONTS.map(font => (
                <option key={font.id} value={font.id}>{font.label}</option>
              ))}
            </select>
          </div>
          <button
            className={`${styles.toolBtn} ${focusMode ? styles.active : ''}`}
            onClick={() => setFocusMode(!focusMode)}
            title="Focus mode"
          >
            ⊡ Focus
          </button>
          <button className={styles.toolBtn} onClick={() => { setAiPanel(!aiPanel); setAiLoading(false) }}>
            ✦ AI
          </button>
          <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: '12px' }} onClick={publish}>
            Publish
          </button>
        </div>
      </div>

      <div className={styles.main}>
        {/* Editor area */}
        <div className={styles.editorCol}>
          {/* Cover emoji + title */}
          <div className={styles.coverArea}>
            <div className={styles.emojiWrapper}>
              <button className={styles.emojiBtn} onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                {article.cover_emoji}
              </button>
              {showEmojiPicker && (
                <div className={styles.emojiPicker}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { handleChange('cover_emoji', e); setShowEmojiPicker(false) }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              className={styles.titleInput}
              style={{ fontFamily: titleFontFamily }}
              placeholder="Title your piece..."
              value={article.title}
              onChange={e => handleChange('title', e.target.value)}
              rows={1}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = t.scrollHeight + 'px'
              }}
            />
          </div>

          {/* Tags */}
          <div className={styles.tagsRow}>
            <span className={styles.tagIcon}>◈</span>
            <input
              className={styles.tagInput}
              placeholder="Add tags, separated by commas..."
              value={tagInput}
              onChange={e => handleTagsChange(e.target.value)}
            />
          </div>

          {/* Bible Verse (optional) */}
          <div className={styles.tagsRow}>
            <span className={styles.tagIcon}>✝</span>
            <input
              className={styles.tagInput}
              placeholder="Bible verse reference (optional) — e.g. John 3:16 or Psalm 23:1-3"
              value={bibleVerseInput}
              onChange={e => {
                setBibleVerseInput(e.target.value)
                handleChange('bible_verse', e.target.value)
              }}
            />
          </div>

          <div className={styles.divider} />

          <div className={styles.formatBar}>
            <button type="button" className={styles.formatBtn} onClick={() => applyInlineFormat('**')} title="Bold">
              B
            </button>
            <button type="button" className={styles.formatBtn} onClick={() => applyInlineFormat('*')} title="Italic">
              I
            </button>
            <button type="button" className={styles.formatBtn} onClick={() => applyInlineFormat('==')} title="Underline">
              U
            </button>
            <button type="button" className={styles.formatBtn} onClick={() => applyLinePrefix('# ')} title="Heading 1">
              H1
            </button>
            <button type="button" className={styles.formatBtn} onClick={() => applyLinePrefix('## ')} title="Heading 2">
              H2
            </button>
            <button type="button" className={styles.formatBtn} onClick={() => applyLinePrefix('- ')} title="Bullet list">
              • List
            </button>
            <button type="button" className={styles.formatBtn} onClick={() => applyLinePrefix('1. ')} title="Numbered list">
              1. List
            </button>
            <button type="button" className={styles.formatBtn} onClick={() => applyLinePrefix('> ')} title="Quote">
              Quote
            </button>
            <button type="button" className={styles.formatBtn} onClick={insertLink} title="Insert link">
              Link
            </button>
          </div>

          {/* Content */}
          <textarea
            ref={textareaRef}
            className={styles.contentInput}
            style={{ fontFamily: bodyFontFamily }}
            placeholder="Begin writing. Your thoughts deserve a beautiful home..."
            value={article.content}
            onChange={e => handleChange('content', e.target.value)}
          />
        </div>

        {/* AI Panel */}
        {aiPanel && (
          <div className={styles.aiPanel}>
            <div className={styles.aiHeader}>
              <h3>✦ AI Assistant</h3>
              <button onClick={() => setAiPanel(false)} className={styles.closeBtn}>✕</button>
            </div>

            <div className={styles.aiActions}>
              <p className={styles.aiSectionLabel}>Writing Actions</p>
              {[
                { action: 'continue', label: '→ Continue writing', desc: 'Adds more to your piece' },
                { action: 'improve', label: '✦ Improve writing', desc: 'Elevates your prose' },
                { action: 'outline', label: '◈ Generate outline', desc: 'Structure your ideas' },
                { action: 'summarize', label: '⊡ Summarize', desc: 'Create article summary' },
                { action: 'prompts', label: '◉ Reflection prompts', desc: 'Deepen your thinking' },
                { action: 'tags', label: '◎ Auto-tag', desc: 'Smart tag suggestions' },
              ].map(item => (
                <button
                  key={item.action}
                  className={`${styles.aiActionBtn} ${aiAction === item.action && aiLoading ? styles.loading : ''}`}
                  onClick={() => runAI(item.action)}
                  disabled={aiLoading}
                >
                  <span className={styles.aiActionLabel}>{item.label}</span>
                  <span className={styles.aiActionDesc}>{item.desc}</span>
                </button>
              ))}

              <p className={styles.aiSectionLabel} style={{ marginTop: '16px' }}>Rewrite Tone</p>
              <div className={styles.toneGrid}>
                {TONES.map(t => (
                  <button
                    key={t}
                    className={`${styles.toneBtn} ${selectedTone === t ? styles.toneActive : ''}`}
                    onClick={() => setSelectedTone(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                className={styles.aiActionBtn}
                onClick={() => runAI('tone')}
                disabled={aiLoading}
              >
                <span className={styles.aiActionLabel}>↺ Apply tone</span>
                <span className={styles.aiActionDesc}>Rewrite in selected style</span>
              </button>

              <p className={styles.aiSectionLabel} style={{ marginTop: '16px' }}>Custom Prompt</p>
              <textarea
                className={styles.customPromptInput}
                placeholder="Ask anything — e.g. 'Make the intro more punchy' or 'Suggest a headline'..."
                value={customPromptText}
                onChange={e => setCustomPromptText(e.target.value)}
                rows={3}
                disabled={aiLoading}
              />
              <div className={styles.customPromptOptions}>
                <label className={styles.contextToggle}>
                  <input
                    type="checkbox"
                    checked={useArticleContext}
                    onChange={e => setUseArticleContext(e.target.checked)}
                  />
                  <span>Include article as context</span>
                </label>
                <button
                  className={styles.aiActionBtn}
                  onClick={() => { if (customPromptText.trim()) runAI('custom') }}
                  disabled={aiLoading || !customPromptText.trim()}
                  style={{ marginTop: '8px' }}
                >
                  <span className={styles.aiActionLabel}>◉ Run prompt</span>
                  <span className={styles.aiActionDesc}>Send your custom instruction</span>
                </button>
              </div>
            </div>

            {/* AI Result */}
            {(aiLoading || aiResult) && (
              <div className={styles.aiResult}>
                <div className={styles.aiResultHeader}>
                  <span>✦ Result</span>
                  {aiResult && !aiLoading && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['continue', 'improve', 'tone'].includes(aiAction) && (
                        <button className="btn btn-primary" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={applyAIResult}>
                          Apply
                        </button>
                      )}
                      <button className={styles.closeBtn} onClick={() => setAiResult('')}>✕</button>
                    </div>
                  )}
                </div>
                {aiLoading ? (
                  <div className={styles.aiThinking}>
                    <span className={styles.pulse}>✦</span>
                    <span>Thinking...</span>
                  </div>
                ) : (
                  <p className={styles.aiText}>{aiResult}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showPublishModal && article.slug && (
        <PublishModal
          articleSlug={article.slug}
          articleTitle={article.title || 'Untitled'}
          onClose={() => setShowPublishModal(false)}
        />
      )}
    </div>
  )
}
