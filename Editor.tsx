import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import PublishModal from '../components/PublishModal'
import RichEditor from '../components/RichEditor'
import {
  continueWriting, improveWriting, summarizeArticle,
  generateOutline, getReflectionPrompts, changeTone, generateTags, customPrompt
} from '../lib/ai'
import type { Article } from '../lib/supabase'
import styles from './Editor.module.css'

const EMOJIS = ['✦','✍️','🕯️','🌿','🔥','💡','🌊','⚡','🎯','📖','🌙','☀️','🦋','🌸','⭐']
const TONES  = ['formal','casual','poetic','devotional','academic','journalistic']
const TITLE_FONTS = [
  { label: 'Playfair (Default)', value: "'Playfair Display', serif" },
  { label: 'DM Sans',            value: "'DM Sans', sans-serif" },
  { label: 'Georgia',            value: 'Georgia, serif' },
  { label: 'Garamond',           value: 'Garamond, serif' },
  { label: 'Lato',               value: "'Lato', sans-serif" },
  { label: 'Courier New',        value: "'Courier New', monospace" },
]

export default function Editor() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, showToast } = useApp()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [article, setArticle] = useState<Partial<Article>>({
    title: '', content: '', summary: '', status: 'draft', tags: [], cover_emoji: '✦', bible_verse: '',
  })
  const [saving, setSaving]                   = useState(false)
  const [saved, setSaved]                     = useState(true)
  const [showPublishModal, setShowPublishModal]= useState(false)
  const [aiPanel, setAiPanel]                 = useState(false)
  const [aiLoading, setAiLoading]             = useState(false)
  const [aiResult, setAiResult]               = useState('')
  const [aiAction, setAiAction]               = useState('')
  const [focusMode, setFocusMode]             = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [tagInput, setTagInput]               = useState('')
  const [bibleVerseInput, setBibleVerseInput] = useState('')
  const [wordCount, setWordCount]             = useState(0)
  const [readingTime, setReadingTime]         = useState(0)
  const [selectedTone, setSelectedTone]       = useState('formal')
  const [customPromptText, setCustomPromptText]= useState('')
  const [useArticleCtx, setUseArticleCtx]     = useState(true)
  const [titleFont, setTitleFont]             = useState(TITLE_FONTS[0].value)
  const [showTitleFonts, setShowTitleFonts]   = useState(false)

  // Initial content from nav state (writing prompts on dashboard)
  const initContent = location.state?.prompt
    ? `<p><em>Prompt: ${location.state.prompt}</em></p><p></p>`
    : ''

  useEffect(() => {
    if (id) loadArticle(id)
    else if (initContent) setArticle(prev => ({ ...prev, content: initContent }))
  }, [id])

  useEffect(() => {
    const text = (article.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const words = text ? text.split(' ').filter(Boolean).length : 0
    setWordCount(words)
    setReadingTime(Math.ceil(words / 200))
  }, [article.content])

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
    const payload = { ...article, user_id: user?.id, word_count: wordCount, reading_time: readingTime, updated_at: new Date().toISOString() }
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

  const handleChange = (field: string, value: any) => { setArticle(prev => ({ ...prev, [field]: value })); setSaved(false) }
  const handleTagsChange = (val: string) => { setTagInput(val); handleChange('tags', val.split(',').map(t => t.trim()).filter(Boolean)) }

  const runAI = async (action: string) => {
    setAiAction(action); setAiLoading(true); setAiResult(''); setAiPanel(true)
    try {
      const plain = (article.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      const title = article.title || ''
      let result = ''
      switch (action) {
        case 'continue':  result = await continueWriting(plain); break
        case 'improve':   result = await improveWriting(plain); break
        case 'summarize': result = await summarizeArticle(plain); handleChange('summary', result); break
        case 'outline':   result = await generateOutline(title || plain); break
        case 'prompts':   result = await getReflectionPrompts(title); break
        case 'tone':      result = await changeTone(plain, selectedTone); break
        case 'custom':    result = await customPrompt(customPromptText, useArticleCtx ? plain : undefined); break
        case 'tags': {
          const tags = await generateTags(title, plain)
          setTagInput(tags.join(', ')); handleChange('tags', tags)
          result = `Suggested tags: ${tags.join(', ')}`; break
        }
      }
      setAiResult(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAiResult(msg.includes('API key') ? '⚠️ Add VITE_GEMINI_API_KEY to your .env file.' : `⚠️ ${msg}`)
    } finally { setAiLoading(false) }
  }

  const applyAIResult = () => {
    if (aiAction === 'continue') {
      const html = (article.content || '') + '<p>' + aiResult.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>'
      handleChange('content', html)
    } else if (['improve','tone'].includes(aiAction)) {
      handleChange('content', aiResult.split('\n\n').filter(Boolean).map(p => `<p>${p}</p>`).join(''))
    }
    setAiPanel(false); setAiResult(''); showToast('AI suggestion applied')
  }

  const publish = async () => {
    if (!article.title?.trim()) { showToast('Please add a title before publishing', 'error'); return }
    const emptyContent = !article.content?.trim() || article.content === '<p></p>' || article.content === '<p><br></p>'
    if (emptyContent) { showToast('Please write some content before publishing', 'error'); return }
    setSaving(true)
    const payload = { ...article, status: 'published', user_id: user?.id, word_count: wordCount, reading_time: readingTime, updated_at: new Date().toISOString() }
    let finalSlug = article.slug
    if (article.id) {
      await supabase.from('articles').update(payload).eq('id', article.id)
    } else {
      finalSlug = (article.title||'untitled').toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Date.now()
      const { data } = await supabase.from('articles').insert({ ...payload, slug: finalSlug }).select().single()
      if (data) { setArticle(prev => ({ ...prev, id: data.id, slug: data.slug, status: 'published' })); finalSlug = data.slug; navigate(`/app/write/${data.id}`, { replace: true }) }
    }
    setArticle(prev => ({ ...prev, status: 'published', slug: finalSlug || prev.slug }))
    setSaving(false); setSaved(true); setShowPublishModal(true)
  }

  const statusColor = article.status === 'published' ? 'var(--green)' : article.status === 'archived' ? 'var(--red)' : 'var(--text-muted)'

  return (
    <div className={`${styles.wrapper} ${focusMode ? styles.focusMode : ''}`}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.toolBtn} onClick={() => navigate('/app/articles')}>← Back</button>
          <div className={styles.separator} />
          <span className={styles.statusDot} style={{ color: statusColor }}>●</span>
          <select value={article.status} onChange={e => handleChange('status', e.target.value)} className={styles.statusSelect}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className={styles.toolbarCenter}>
          <span className={styles.wordCount}>{wordCount} words · {readingTime} min read</span>
          <span className={styles.saveIndicator}>{saving ? '◌ Saving...' : saved ? '✓ Saved' : '● Unsaved'}</span>
        </div>
        <div className={styles.toolbarRight}>
          <button className={`${styles.toolBtn} ${focusMode ? styles.active : ''}`} onClick={() => setFocusMode(!focusMode)}>⊡ Focus</button>
          <button className={styles.toolBtn} onClick={() => { setAiPanel(!aiPanel); setAiLoading(false) }}>✦ AI</button>
          <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: '12px' }} onClick={publish}>Publish</button>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.editorCol}>
          {/* Emoji + Title */}
          <div className={styles.coverArea}>
            <div className={styles.emojiWrapper}>
              <button className={styles.emojiBtn} onClick={() => setShowEmojiPicker(!showEmojiPicker)}>{article.cover_emoji}</button>
              {showEmojiPicker && (
                <div className={styles.emojiPicker}>
                  {EMOJIS.map(e => <button key={e} onClick={() => { handleChange('cover_emoji', e); setShowEmojiPicker(false) }}>{e}</button>)}
                </div>
              )}
            </div>
            <div className={styles.titleArea}>
              <div className={styles.titleMeta}>
                <div className={styles.fontPickerWrap}>
                  <button className={styles.fontPickerBtn} onClick={() => setShowTitleFonts(!showTitleFonts)} title="Change title font">Aa ▾</button>
                  {showTitleFonts && (
                    <div className={styles.fontDropdown}>
                      {TITLE_FONTS.map(f => (
                        <button key={f.value} className={`${styles.fontOption} ${titleFont === f.value ? styles.fontActive : ''}`}
                          style={{ fontFamily: f.value }} onClick={() => { setTitleFont(f.value); setShowTitleFonts(false) }}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <textarea
                className={styles.titleInput}
                style={{ fontFamily: titleFont }}
                placeholder="Title your piece..."
                value={article.title}
                onChange={e => handleChange('title', e.target.value)}
                rows={1}
                onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
              />
            </div>
          </div>

          {/* Tags */}
          <div className={styles.metaRow}>
            <span className={styles.metaIcon}>◈</span>
            <input className={styles.metaInput} placeholder="Tags, separated by commas..." value={tagInput} onChange={e => handleTagsChange(e.target.value)} />
          </div>

          {/* Bible verse */}
          <div className={styles.metaRow}>
            <span className={styles.metaIcon}>✝</span>
            <input className={styles.metaInput} placeholder="Bible verse (optional) — e.g. John 3:16" value={bibleVerseInput}
              onChange={e => { setBibleVerseInput(e.target.value); handleChange('bible_verse', e.target.value) }} />
          </div>

          {/* Summary */}
          <div className={styles.summarySection}>
            <div className={styles.summaryHeader}>
              <span className={styles.metaIcon}>⊡</span>
              <span className={styles.summaryLabel}>Summary</span>
              <span className={styles.summaryHint}>Shown in article previews · AI can auto-fill this</span>
            </div>
            <textarea
              className={styles.summaryInput}
              placeholder="Write a short summary of your article (2–3 sentences)..."
              value={article.summary || ''}
              onChange={e => handleChange('summary', e.target.value)}
              rows={2}
            />
          </div>

          <div className={styles.divider} />

          {/* Rich editor */}
          <RichEditor
            content={article.content || ''}
            onChange={html => handleChange('content', html)}
            placeholder="Begin writing. Your thoughts deserve a beautiful home..."
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
                { action: 'continue',  label: '→ Continue writing', desc: 'Adds more to your piece' },
                { action: 'improve',   label: '✦ Improve writing',  desc: 'Elevates your prose' },
                { action: 'outline',   label: '◈ Generate outline', desc: 'Structure your ideas' },
                { action: 'summarize', label: '⊡ Auto-summarize',   desc: 'Fills summary field' },
                { action: 'prompts',   label: '◉ Reflection prompts', desc: 'Deepen your thinking' },
                { action: 'tags',      label: '◎ Auto-tag',         desc: 'Smart tag suggestions' },
              ].map(item => (
                <button key={item.action} className={`${styles.aiActionBtn} ${aiAction === item.action && aiLoading ? styles.loading : ''}`}
                  onClick={() => runAI(item.action)} disabled={aiLoading}>
                  <span className={styles.aiActionLabel}>{item.label}</span>
                  <span className={styles.aiActionDesc}>{item.desc}</span>
                </button>
              ))}

              <p className={styles.aiSectionLabel} style={{ marginTop: '16px' }}>Rewrite Tone</p>
              <div className={styles.toneGrid}>
                {TONES.map(t => <button key={t} className={`${styles.toneBtn} ${selectedTone === t ? styles.toneActive : ''}`} onClick={() => setSelectedTone(t)}>{t}</button>)}
              </div>
              <button className={styles.aiActionBtn} onClick={() => runAI('tone')} disabled={aiLoading}>
                <span className={styles.aiActionLabel}>↺ Apply tone</span>
                <span className={styles.aiActionDesc}>Rewrite in selected style</span>
              </button>

              <p className={styles.aiSectionLabel} style={{ marginTop: '16px' }}>Custom Prompt</p>
              <textarea className={styles.customPromptInput} placeholder="Ask anything..." value={customPromptText}
                onChange={e => setCustomPromptText(e.target.value)} rows={3} disabled={aiLoading} />
              <label className={styles.contextToggle}>
                <input type="checkbox" checked={useArticleCtx} onChange={e => setUseArticleCtx(e.target.checked)} />
                <span>Include article as context</span>
              </label>
              <button className={styles.aiActionBtn} onClick={() => { if (customPromptText.trim()) runAI('custom') }}
                disabled={aiLoading || !customPromptText.trim()} style={{ marginTop: '6px' }}>
                <span className={styles.aiActionLabel}>◉ Run prompt</span>
                <span className={styles.aiActionDesc}>Send your custom instruction</span>
              </button>
            </div>

            {(aiLoading || aiResult) && (
              <div className={styles.aiResult}>
                <div className={styles.aiResultHeader}>
                  <span>✦ Result</span>
                  {aiResult && !aiLoading && (
                    <div style={{ display:'flex', gap:'8px' }}>
                      {['continue','improve','tone'].includes(aiAction) && (
                        <button className="btn btn-primary" style={{ fontSize:'11px', padding:'5px 12px' }} onClick={applyAIResult}>Apply</button>
                      )}
                      <button className={styles.closeBtn} onClick={() => setAiResult('')}>✕</button>
                    </div>
                  )}
                </div>
                {aiLoading
                  ? <div className={styles.aiThinking}><span className={styles.pulse}>✦</span><span>Thinking...</span></div>
                  : <p className={styles.aiText}>{aiResult}</p>
                }
              </div>
            )}
          </div>
        )}
      </div>

      {showPublishModal && article.slug && (
        <PublishModal articleSlug={article.slug} articleTitle={article.title || 'Untitled'} onClose={() => setShowPublishModal(false)} />
      )}
    </div>
  )
}
