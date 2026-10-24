import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import {
  supabase,
  saveArticleVersion,
  getUserSeries,
  notifyFollowersOfNewArticle
} from '../lib/supabase'
import { useApp } from '../context/AppContext'
import PublishModal from '../components/PublishModal'
import RichEditor from '../components/RichEditor'
import VersionHistoryDrawer from '../components/VersionHistoryDrawer'
import {
  continueWriting, improveWriting, summarizeArticle,
  generateOutline, getReflectionPrompts, changeTone, generateTags, customPrompt,
  DEFAULT_MAX_CHARS, ARTICLE_TOO_LONG_MSG, formatAiErrorMessage, formatAiInsertion
} from '../lib/ai'
import type { Article, ArticleVersion, Series } from '../lib/supabase'
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
  const aiResultRef = useRef<HTMLDivElement | null>(null)

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
  const [historyOpen, setHistoryOpen]         = useState(false)
  const [userSeries, setUserSeries]           = useState<Series[]>([])
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

  const scrollAiBoxIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      aiResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    setTimeout(() => {
      aiResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 60)
  }, [])

  useEffect(() => {
    if (aiLoading || aiResult) {
      scrollAiBoxIntoView()
    }
  }, [aiLoading, aiResult, scrollAiBoxIntoView])

  // Load user series
  useEffect(() => {
    if (user?.id) {
      getUserSeries(user.id).then(setUserSeries).catch(() => {})
    }
  }, [user?.id])

  // Check URL query params for series or prompt
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const seriesParam = searchParams.get('series')
    if (seriesParam) {
      setArticle(prev => ({ ...prev, series_id: seriesParam }))
    }
  }, [location.search])

  // Initial content from nav state
  const initContent = location.state?.initialContent || (location.state?.prompt
    ? `<p><em>Prompt: ${location.state.prompt}</em></p><p></p>`
    : '')

  const loadArticle = useCallback(async (articleId: string) => {
    const { data } = await supabase.from('articles').select('*').eq('id', articleId).single()
    if (data) {
      setArticle(data)
      setTagInput(data.tags?.join(', ') || '')
      setBibleVerseInput(data.bible_verse || '')
    }
  }, [])

  useEffect(() => {
    if (id) {
      loadArticle(id)
    } else {
      if (initContent) {
        setArticle(prev => ({
          ...prev,
          content: initContent,
          title: location.state?.prompt ? String(location.state.prompt) : prev.title,
          bible_verse: location.state?.bibleVerse || prev.bible_verse
        }))
        if (location.state?.bibleVerse) {
          setBibleVerseInput(location.state.bibleVerse)
        }
      }
    }
  }, [id, initContent, loadArticle, location.state])

  useEffect(() => {
    const text = (article.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const words = text ? text.split(' ').filter(Boolean).length : 0
    setWordCount(words)
    setReadingTime(Math.ceil(words / 200))
  }, [article.content])

  const autoSave = useCallback(async () => {
    if (!article.title && !article.content) return
    setSaving(true)
    const payload = { ...article, user_id: user?.id, word_count: wordCount, reading_time: readingTime, updated_at: new Date().toISOString() }
    if (article.id) {
      await supabase.from('articles').update(payload).eq('id', article.id)
      if (user?.id) {
        saveArticleVersion(article.id, user.id, {
          title: article.title || 'Untitled',
          content: article.content || '',
          summary: article.summary,
          reason: 'Autosave'
        }).catch(() => {})
      }
    } else {
      const slug = (article.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
      const { data } = await supabase.from('articles').insert({ ...payload, slug }).select().single()
      if (data) {
        setArticle(prev => ({ ...prev, id: data.id, slug: data.slug }))
        if (user?.id) {
          saveArticleVersion(data.id, user.id, {
            title: data.title || 'Untitled',
            content: data.content || '',
            summary: data.summary,
            reason: 'Initial Draft'
          }).catch(() => {})
        }
        navigate(`/app/write/${data.id}`, { replace: true })
      }
    }
    setSaving(false)
    setSaved(true)
  }, [article, user?.id, wordCount, readingTime, navigate])

  useEffect(() => {
    if (!saved) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => autoSave(), 2000) as unknown as ReturnType<typeof setTimeout>
    }
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [saved, autoSave])

  const handleChange = (field: string, value: Article[keyof Article] | string | undefined) => {
    setArticle(prev => ({ ...prev, [field]: value } as Partial<Article>))
    setSaved(false)
  }

  const handleTagsChange = (val: string) => {
    setTagInput(val)
    handleChange('tags', val.split(',').map(t => t.trim()).filter(Boolean))
  }

  const runAI = async (action: string) => {
    setAiAction(action); setAiLoading(true); setAiResult(''); setAiPanel(true)
    scrollAiBoxIntoView()
    try {
      const plain = (article.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      const title = article.title || ''

      if (['improve', 'tone'].includes(action) && plain.length > DEFAULT_MAX_CHARS) {
        setAiResult(ARTICLE_TOO_LONG_MSG)
        scrollAiBoxIntoView()
        return
      }

      let result = ''
      switch (action) {
        case 'continue':  result = await continueWriting(plain); break
        case 'improve':   result = await improveWriting(plain); break
        case 'summarize': {
          result = await summarizeArticle(plain)
          handleChange('summary', result); break
        }
        case 'outline':   result = await generateOutline(title || plain.slice(0, 80)); break
        case 'prompts':   result = await getReflectionPrompts(title || plain.slice(0, 80)); break
        case 'tone':      result = await changeTone(plain, selectedTone); break
        case 'tags': {
          const tags = await generateTags(title, plain)
          setTagInput(tags.join(', ')); handleChange('tags', tags)
          result = `Suggested tags: ${tags.join(', ')}`; break
        }
      }
      setAiResult(result)
      scrollAiBoxIntoView()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAiResult(formatAiErrorMessage(msg))
      scrollAiBoxIntoView()
    } finally {
      setAiLoading(false)
      scrollAiBoxIntoView()
    }
  }

  const handleCustomPrompt = async () => {
    if (!customPromptText.trim()) return
    setAiAction('custom'); setAiLoading(true); setAiResult(''); setAiPanel(true)
    scrollAiBoxIntoView()
    try {
      const plain = (article.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      const result = await customPrompt(customPromptText.trim(), useArticleCtx ? plain : undefined)
      setAiResult(result)
      scrollAiBoxIntoView()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAiResult(formatAiErrorMessage(msg))
      scrollAiBoxIntoView()
    } finally {
      setAiLoading(false)
      scrollAiBoxIntoView()
    }
  }

  const applyAIResult = async () => {
    if (!aiResult || aiResult.startsWith('⚠️')) return

    // Critical Safety Net: Save checkpoint snapshot before AI overwrite/append
    if (article.id && user?.id) {
      try {
        await saveArticleVersion(article.id, user.id, {
          title: article.title || 'Untitled',
          content: article.content || '',
          summary: article.summary,
          reason: 'Before AI Apply'
        })
      } catch (err) {
        console.warn('Could not save safety snapshot before AI apply', err)
      }
    }

    const html = formatAiInsertion(aiAction, article.content || '', aiResult)
    handleChange('content', html)
    setAiPanel(false)
    setAiResult('')
    showToast('AI suggestion applied (snapshot saved to History)')
  }

  const handleManualSave = async () => {
    await autoSave()
    if (article.id && user?.id) {
      await saveArticleVersion(article.id, user.id, {
        title: article.title || 'Untitled',
        content: article.content || '',
        summary: article.summary,
        reason: 'Saved checkpoint'
      })
      showToast('Checkpoint saved to History')
    }
  }

  const publish = async () => {
    if (!article.title?.trim()) { showToast('Please add a title before publishing', 'error'); return }
    const emptyContent = !article.content?.trim() || article.content === '<p></p>' || article.content === '<p><br></p>'
    if (emptyContent) { showToast('Please write some content before publishing', 'error'); return }

    setSaving(true)
    const payload = { ...article, status: 'published', user_id: user?.id, word_count: wordCount, reading_time: readingTime, updated_at: new Date().toISOString() }
    let finalSlug = article.slug
    let publishedId = article.id

    if (article.id) {
      await supabase.from('articles').update(payload).eq('id', article.id)
    } else {
      finalSlug = (article.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
      const { data } = await supabase.from('articles').insert({ ...payload, slug: finalSlug }).select().single()
      if (data) {
        publishedId = data.id
        setArticle(prev => ({ ...prev, id: data.id, slug: data.slug, status: 'published' }))
        finalSlug = data.slug
        navigate(`/app/write/${data.id}`, { replace: true })
      }
    }

    // Save publish checkpoint
    if (publishedId && user?.id) {
      await saveArticleVersion(publishedId, user.id, {
        title: article.title || 'Untitled',
        content: article.content || '',
        summary: article.summary,
        reason: 'Saved checkpoint (Publish)'
      }).catch(() => {})

      // Notify followers of publication
      notifyFollowersOfNewArticle(user.id, {
        id: publishedId,
        title: article.title || 'Untitled',
        slug: finalSlug || article.slug || ''
      }).catch(() => {})
    }

    setArticle(prev => ({ ...prev, status: 'published', slug: finalSlug || prev.slug }))
    setSaving(false)
    setSaved(true)
    setShowPublishModal(true)
  }

  const handleRestoreVersion = async (version: ArticleVersion) => {
    handleChange('title', version.title)
    handleChange('content', version.content)
    if (version.summary) handleChange('summary', version.summary)
    setSaved(false)

    if (article.id && user?.id) {
      await saveArticleVersion(article.id, user.id, {
        title: version.title,
        content: version.content,
        summary: version.summary,
        reason: 'Restored from history'
      }).catch(() => {})
    }

    showToast(`Restored version from ${new Date(version.created_at).toLocaleTimeString()}`)
  }

  const statusColor = article.status === 'published' ? 'var(--green)' : article.status === 'archived' ? 'var(--red)' : 'var(--text-muted)'

  return (
    <div className={`${styles.wrapper} ${focusMode ? styles.focusMode : ''}`}>
      {/* Top Toolbar */}
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
          <button className={`${styles.toolBtn} ${focusMode ? styles.active : ''}`} onClick={() => setFocusMode(!focusMode)}>
            ⊡ Focus
          </button>
          <button className={styles.toolBtn} onClick={() => setHistoryOpen(true)} title="View version history snapshots">
            ⏳ History
          </button>
          <button className={styles.toolBtn} onClick={handleManualSave} title="Save checkpoint">
            💾 Checkpoint
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

          {/* Series selector */}
          <div className={styles.metaRow} style={{ alignItems: 'center' }}>
            <span className={styles.metaIcon}>📚</span>
            <select
              className={styles.seriesSelect}
              value={article.series_id || ''}
              onChange={e => handleChange('series_id', e.target.value || undefined)}
            >
              <option value="">No Series (Standalone Story)</option>
              {userSeries.map(s => (
                <option key={s.id} value={s.id}>
                  {s.cover_emoji || '📚'} {s.title}
                </option>
              ))}
            </select>
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
            placeholder="Tell your story. Format with toolbar, write freely..."
          />
        </div>

        {/* AI Assistant panel */}
        {aiPanel && (
          <aside className={styles.aiPanel}>
            <div className={styles.aiPanelHeader}>
              <div className={styles.aiHeaderLeft}>
                <span className={styles.sparkle}>✦</span>
                <span className={styles.aiPanelTitle}>Editorial Assistant</span>
              </div>
              <button className={styles.closeAi} onClick={() => setAiPanel(false)}>×</button>
            </div>

            <div className={styles.aiScrollArea}>
              <div className={styles.aiActions}>
                <p className={styles.aiGroupLabel}>Compose & Polish</p>
                <button className={styles.aiActionBtn} onClick={() => runAI('continue')} disabled={aiLoading}>
                  <span>✍️</span><span>Continue Writing</span>
                </button>
                <button className={styles.aiActionBtn} onClick={() => runAI('improve')} disabled={aiLoading}>
                  <span>✦</span><span>Improve & Polish</span>
                </button>

                <p className={styles.aiGroupLabel}>Tone & Style</p>
                <div className={styles.toneSelector}>
                  <select value={selectedTone} onChange={e => setSelectedTone(e.target.value)} className={styles.toneSelect}>
                    {TONES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                  <button className={styles.aiActionBtnSmall} onClick={() => runAI('tone')} disabled={aiLoading}>
                    Apply Tone
                  </button>
                </div>

                <p className={styles.aiGroupLabel}>Structure & Metadata</p>
                <button className={styles.aiActionBtn} onClick={() => runAI('summarize')} disabled={aiLoading}>
                  <span>⊡</span><span>Auto-summarize</span>
                </button>
                <button className={styles.aiActionBtn} onClick={() => runAI('outline')} disabled={aiLoading}>
                  <span>◈</span><span>Generate Outline</span>
                </button>
                <button className={styles.aiActionBtn} onClick={() => runAI('tags')} disabled={aiLoading}>
                  <span>🏷️</span><span>Suggest Tags</span>
                </button>
                <button className={styles.aiActionBtn} onClick={() => runAI('prompts')} disabled={aiLoading}>
                  <span>💡</span><span>Reflection Prompts</span>
                </button>

                <p className={styles.aiGroupLabel}>Custom Instruction</p>
                <div className={styles.customPromptWrap}>
                  <textarea
                    className={styles.customPromptInput}
                    placeholder="Ask Gemini to critique, rephrase, expand..."
                    value={customPromptText}
                    onChange={e => setCustomPromptText(e.target.value)}
                    rows={2}
                    disabled={aiLoading}
                  />
                  <div className={styles.customPromptOptions}>
                    <label className={styles.contextToggle}>
                      <input
                        type="checkbox"
                        checked={useArticleCtx}
                        onChange={e => setUseArticleCtx(e.target.checked)}
                      />
                      <span>Include article as context</span>
                    </label>
                    <button
                      className={styles.aiActionBtnSmall}
                      onClick={handleCustomPrompt}
                      disabled={aiLoading || !customPromptText.trim()}
                    >
                      Ask AI →
                    </button>
                  </div>
                </div>
              </div>

              {(aiLoading || aiResult) && (
                <div ref={aiResultRef} className={styles.aiResult}>
                  <div className={styles.aiResultHeader}>
                    <span>✦ Result</span>
                    {aiResult && !aiLoading && (
                      <div className={styles.aiResultBtns}>
                        {['continue', 'improve', 'tone'].includes(aiAction) && (
                          <button className={styles.applyBtn} onClick={applyAIResult}>Apply</button>
                        )}
                        <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(aiResult); showToast('Copied to clipboard') }}>Copy</button>
                      </div>
                    )}
                  </div>
                  {aiLoading ? (
                    <div className={styles.aiLoadingText}>
                      <span className={styles.aiSpin}>✦</span> Generating thoughtful response...
                    </div>
                  ) : (
                    <div className={styles.aiResultText}>{aiResult}</div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        articleId={article.id || ''}
        onRestore={handleRestoreVersion}
      />

      {/* Publish Modal */}
      {showPublishModal && (
        <PublishModal
          articleSlug={article.slug || ''}
          articleTitle={article.title || 'Untitled'}
          onClose={() => setShowPublishModal(false)}
        />
      )}
    </div>
  )
}
