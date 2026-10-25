import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  globalSearch,
  followWriter,
  unfollowWriter,
  type GlobalSearchResult,
  type SearchWriterResult,
  type Article,
  type Series,
  type Community,
} from '../lib/supabase'
import { useApp } from '../context/AppContext'
import styles from './GlobalSearchModal.module.css'

type FilterTab = 'all' | 'writers' | 'articles' | 'series' | 'communities'

export default function GlobalSearchModal() {
  const { user, showToast } = useApp()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GlobalSearchResult>({
    writers: [],
    articles: [],
    series: [],
    communities: [],
  })
  const [followBusyId, setFollowBusyId] = useState<string | null>(null)

  const runSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const data = await globalSearch(q, user?.id)
      setResults(data)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Global keyboard shortcut (Ctrl+K / Cmd+K) & custom event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ query?: string }>
      if (customEvent.detail?.query !== undefined) {
        setQuery(customEvent.detail.query)
      }
      setOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('inkwell:open-search', handleCustomOpen)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('inkwell:open-search', handleCustomOpen)
    }
  }, [])

  // Auto-focus input & load results when modal opens or query changes
  useEffect(() => {
    if (!open) return
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus()
    }, 30)

    const debounceTimer = setTimeout(() => {
      void runSearch(query)
    }, query ? 140 : 0)

    return () => {
      clearTimeout(focusTimer)
      clearTimeout(debounceTimer)
    }
  }, [open, query, runSearch])

  const closeModal = () => {
    setOpen(false)
  }

  const handleToggleFollow = async (e: React.MouseEvent, writer: SearchWriterResult) => {
    e.stopPropagation()
    e.preventDefault()
    if (!user?.id) {
      showToast('Sign in to follow writers', 'error')
      return
    }
    if (user.id === writer.id) return

    setFollowBusyId(writer.id)
    try {
      if (writer.is_following) {
        await unfollowWriter(user.id, writer.id)
        setResults(prev => ({
          ...prev,
          writers: prev.writers.map(w =>
            w.id === writer.id
              ? { ...w, is_following: false, follower_count: Math.max(0, w.follower_count - 1) }
              : w
          ),
        }))
        showToast(`Unfollowed ${writer.full_name}`)
      } else {
        await followWriter(user.id, writer.id)
        setResults(prev => ({
          ...prev,
          writers: prev.writers.map(w =>
            w.id === writer.id
              ? { ...w, is_following: true, follower_count: w.follower_count + 1 }
              : w
          ),
        }))
        showToast(`Following ${writer.full_name} ✦`)
      }
    } finally {
      setFollowBusyId(null)
    }
  }

  const handleSelectWriter = (writer: SearchWriterResult) => {
    closeModal()
    navigate(`/writer/${writer.id}`)
  }

  const handleSelectArticle = (article: Article) => {
    closeModal()
    if (article.status !== 'published' && user?.id === article.user_id) {
      navigate(`/app/write/${article.id}`)
    } else if (article.slug) {
      navigate(`/p/${article.slug}`)
    } else {
      navigate(`/app/write/${article.id}`)
    }
  }

  const handleSelectSeries = (_series: Series) => {
    void _series
    closeModal()
    navigate(user ? '/app/series' : '/discover')
  }

  const handleSelectCommunity = (community: Community) => {
    closeModal()
    navigate(`/c/${community.slug}`)
  }

  if (!open) return null

  const totalCount =
    results.writers.length +
    results.articles.length +
    results.series.length +
    results.communities.length

  const showWriters = activeTab === 'all' || activeTab === 'writers'
  const showArticles = activeTab === 'all' || activeTab === 'articles'
  const showSeries = activeTab === 'all' || activeTab === 'series'
  const showCommunities = activeTab === 'all' || activeTab === 'communities'

  return (
    <div className={styles.overlay} onClick={closeModal} role="dialog" aria-modal="true" aria-label="Search Inkwell">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Top Search Input Row */}
        <div className={styles.searchHeader}>
          <span className={styles.searchIcon} aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search writers, articles, series, or communities…"
            aria-label="Search query"
          />
          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              title="Clear"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            className={styles.escBadge}
            onClick={closeModal}
            title="Close search (Esc)"
          >
            ESC
          </button>
        </div>

        {/* Segmented Filter Pills */}
        <div className={styles.filterBar} role="tablist" aria-label="Search categories">
          {([
            { key: 'all',         label: 'All',         count: totalCount },
            { key: 'writers',     label: 'Writers',     count: results.writers.length },
            { key: 'articles',    label: 'Articles',    count: results.articles.length },
            { key: 'series',      label: 'Series',      count: results.series.length },
            { key: 'communities', label: 'Communities', count: results.communities.length },
          ] as { key: FilterTab; label: string; count: number }[]).map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`${styles.filterPill} ${activeTab === tab.key ? styles.filterPillActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.label}</span>
              <span className={styles.filterCount}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Results Body */}
        <div className={styles.resultsBody}>
          {loading ? (
            <div className={styles.loadingState}>
              <span className={styles.spinner}>✦</span>
              <span>Searching Inkwell…</span>
            </div>
          ) : totalCount === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✦</span>
              <p className={styles.emptyTitle}>
                {query ? `No matches found for "${query}"` : 'Start typing to explore Inkwell'}
              </p>
              <p className={styles.emptySub}>
                Try searching by writer name, article topic, tag, series, or community.
              </p>
            </div>
          ) : (
            <>
              {/* 1. WRITERS */}
              {showWriters && results.writers.length > 0 && (
                <div className={styles.resultSection}>
                  <div className={styles.sectionLabel}>
                    <span>WRITERS</span>
                    <span className={styles.sectionCount}>{results.writers.length}</span>
                  </div>
                  <div className={styles.itemList}>
                    {results.writers.map(writer => {
                      const initials = (writer.full_name || 'W')
                        .split(' ')
                        .filter(Boolean)
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                      return (
                        <div
                          key={writer.id}
                          className={styles.writerRow}
                          onClick={() => handleSelectWriter(writer)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter') handleSelectWriter(writer) }}
                        >
                          {writer.avatar_url ? (
                            <img src={writer.avatar_url} alt={writer.full_name} className={styles.writerAvatarImg} />
                          ) : (
                            <div className={styles.writerAvatar}>{initials}</div>
                          )}
                          <div className={styles.writerInfo}>
                            <div className={styles.writerTitleLine}>
                              <span className={styles.writerName}>{writer.full_name}</span>
                              <span className={styles.writerStatsBadge}>
                                {writer.follower_count} Follower{writer.follower_count === 1 ? '' : 's'}
                              </span>
                            </div>
                            {writer.bio && <p className={styles.writerBio}>{writer.bio}</p>}
                          </div>
                          <div className={styles.writerActions}>
                            {user && user.id !== writer.id && (
                              <button
                                type="button"
                                className={`${styles.followBtn} ${writer.is_following ? styles.followingBtn : ''}`}
                                onClick={e => handleToggleFollow(e, writer)}
                                disabled={followBusyId === writer.id}
                              >
                                {writer.is_following ? '✓ Following' : '+ Follow'}
                              </button>
                            )}
                            <span className={styles.viewProfileLink}>View Profile →</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 2. ARTICLES */}
              {showArticles && results.articles.length > 0 && (
                <div className={styles.resultSection}>
                  <div className={styles.sectionLabel}>
                    <span>ARTICLES</span>
                    <span className={styles.sectionCount}>{results.articles.length}</span>
                  </div>
                  <div className={styles.itemList}>
                    {results.articles.map(article => {
                      const snippet =
                        article.summary ||
                        (article.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110)
                      return (
                        <div
                          key={article.id}
                          className={styles.articleRow}
                          onClick={() => handleSelectArticle(article)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter') handleSelectArticle(article) }}
                        >
                          <div className={styles.articleEmoji}>{article.cover_emoji || '✦'}</div>
                          <div className={styles.articleContent}>
                            <div className={styles.articleTopRow}>
                              <h4 className={styles.articleTitle}>{article.title || 'Untitled'}</h4>
                              {article.status !== 'published' && (
                                <span className={styles.draftBadge}>{article.status}</span>
                              )}
                            </div>
                            {snippet && <p className={styles.articleSnippet}>{snippet}</p>}
                            <div className={styles.articleMetaRow}>
                              {article.author?.full_name && (
                                <span className={styles.articleByline}>By {article.author.full_name}</span>
                              )}
                              <span>{article.reading_time || 5} min read</span>
                              {Array.isArray(article.tags) && article.tags.slice(0, 3).map(tag => (
                                <span key={tag} className={styles.tagPill}>#{tag}</span>
                              ))}
                            </div>
                          </div>
                          <span className={styles.rowArrow}>→</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 3. SERIES */}
              {showSeries && results.series.length > 0 && (
                <div className={styles.resultSection}>
                  <div className={styles.sectionLabel}>
                    <span>SERIES &amp; COLLECTIONS</span>
                    <span className={styles.sectionCount}>{results.series.length}</span>
                  </div>
                  <div className={styles.itemList}>
                    {results.series.map(s => (
                      <div
                        key={s.id}
                        className={styles.articleRow}
                        onClick={() => handleSelectSeries(s)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') handleSelectSeries(s) }}
                      >
                        <div className={styles.articleEmoji}>{s.cover_emoji || '📚'}</div>
                        <div className={styles.articleContent}>
                          <h4 className={styles.articleTitle}>{s.title}</h4>
                          {s.description && <p className={styles.articleSnippet}>{s.description}</p>}
                        </div>
                        <span className={styles.viewProfileLink}>Open Series →</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. COMMUNITIES */}
              {showCommunities && results.communities.length > 0 && (
                <div className={styles.resultSection}>
                  <div className={styles.sectionLabel}>
                    <span>COMMUNITIES</span>
                    <span className={styles.sectionCount}>{results.communities.length}</span>
                  </div>
                  <div className={styles.itemList}>
                    {results.communities.map(c => (
                      <div
                        key={c.id}
                        className={styles.articleRow}
                        onClick={() => handleSelectCommunity(c)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') handleSelectCommunity(c) }}
                      >
                        <div className={styles.articleEmoji}>{c.emoji || '🏛️'}</div>
                        <div className={styles.articleContent}>
                          <div className={styles.articleTopRow}>
                            <h4 className={styles.articleTitle}>{c.name}</h4>
                            {c.category && <span className={styles.tagPill}>{c.category}</span>}
                          </div>
                          {c.description && <p className={styles.articleSnippet}>{c.description}</p>}
                        </div>
                        <span className={styles.viewProfileLink}>Visit →</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Shortcut Hint */}
        <div className={styles.footer}>
          <span>Press <kbd>Ctrl</kbd> + <kbd>K</kbd> anytime to search</span>
          <span>Click any result to open</span>
        </div>
      </div>
    </div>
  )
}
