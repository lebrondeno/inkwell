import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  supabase,
  fetchVerseOfDay,
  getWritingStreak,
  getFollowingFeed,
  getUserBookmarks,
  toggleBookmark,
  openGlobalSearch,
} from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatDistanceToNow } from 'date-fns'
import type { Article, BibleVerse, WritingStreak } from '../lib/supabase'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { user, showToast } = useApp()
  const navigate = useNavigate()

  const [myArticles, setMyArticles] = useState<Article[]>([])
  const [followingArticles, setFollowingArticles] = useState<Article[]>([])
  const [discoverArticles, setDiscoverArticles] = useState<Article[]>([])
  const [bookmarkedArticles, setBookmarkedArticles] = useState<Article[]>([])

  const [activeTab, setActiveTab] = useState<'following' | 'discover' | 'bookmarks'>('following')
  const [verse, setVerse] = useState<BibleVerse | null>(null)
  const [streak, setStreak] = useState<WritingStreak>({ currentStreak: 0, longestStreak: 0, lastActiveDate: null })

  const [loading, setLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'Writer'

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      const [streakData, verseData, myData, followingData, discoverData, bookmarkData] = await Promise.all([
        getWritingStreak(user.id),
        fetchVerseOfDay(),
        supabase.from('articles').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(5),
        getFollowingFeed(user.id),
        supabase.from('articles').select('*').eq('status', 'published').neq('user_id', user.id).order('created_at', { ascending: false }).limit(6),
        getUserBookmarks(user.id),
      ])

      setStreak(streakData)
      setVerse(verseData)
      setMyArticles(myData.data || [])
      setFollowingArticles(followingData)
      setDiscoverArticles(discoverData.data || [])
      setBookmarkedArticles(bookmarkData)

      // Default to Discover if no following articles yet
      if (followingData.length === 0 && (discoverData.data || []).length > 0) {
        setActiveTab('discover')
      }
    } finally {
      setLoading(false)
      setFeedLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRemoveBookmark = async (e: React.MouseEvent, articleId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user?.id) return
    await toggleBookmark(articleId, user.id)
    setBookmarkedArticles(prev => prev.filter(a => a.id !== articleId))
    showToast('Removed from Reading List')
  }

  const handleWriteReflection = () => {
    const verseText = verse ? `"${verse.text.trim()}" — ${verse.reference}` : ''
    const reflectionPrompt = verseText
      ? `<p><em>Daily Reflection on ${verse?.reference}:</em></p><blockquote><p>${verse?.text.trim()}</p></blockquote><p></p>`
      : '<p><em>Daily Reflection:</em></p><p></p>'

    navigate('/app/write?prompt=reflection', {
      state: {
        prompt: verseText ? `Daily Reflection on ${verse?.reference}` : 'Daily Reflection',
        initialContent: reflectionPrompt,
        bibleVerse: verse?.reference || ''
      }
    })
  }

  const stats = {
    total:     myArticles.length,
    published: myArticles.filter(a => a.status === 'published').length,
    words:     myArticles.reduce((sum, a) => sum + (a.word_count || 0), 0),
    views:     myArticles.reduce((sum, a) => sum + (a.view_count || 0), 0),
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className={`${styles.page} ${styles.dashboard}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.kicker}>THE WRITER&apos;S DESK — DAILY DISPATCH</p>
          <h1 className={styles.title}>
            {greeting}, <em className={styles.titleAccent}>{displayName}</em>
          </h1>
          <p className={styles.sub}>Craft timeless prose, reflect deeply, and publish stories worth remembering.</p>
        </div>
        <button className={`btn btn-primary ${styles.newArticleBtn}`} onClick={() => navigate('/app/write')}>
          ✦ New Article
        </button>
      </div>

      {/* Daily Reflection & Streak Card */}
      <div className={styles.reflectionCard}>
        <div className={styles.reflectionTop}>
          <div className={styles.reflectionEyebrow}>
            <span>✦</span>
            <span>Daily Reflection &amp; Streak</span>
          </div>
          <div className={styles.streakPill}>
            <span>🔥</span>
            <span>{streak.currentStreak} Day Streak</span>
          </div>
        </div>

        {verse ? (
          <>
            <p className={styles.verseText}>&ldquo;{verse.text.trim()}&rdquo;</p>
            <p className={styles.verseRef}>— {verse.reference} ({verse.translation_name || 'KJV'})</p>
          </>
        ) : (
          <p className={styles.verseText}>&ldquo;Commit thy works unto the Lord, and thy thoughts shall be established.&rdquo; — Proverbs 16:3</p>
        )}

        <div className={styles.reflectionActions}>
          <span className={styles.reflectionPromptText}>
            Pause, reflect, and write your thoughts for today.
          </span>
          <button className={styles.reflectionBtn} onClick={handleWriteReflection}>
            ✍️ Write Today&apos;s Reflection
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.stats}>
        {[
          { label: 'Total Articles', value: stats.total,                 icon: '◈' },
          { label: 'Published',      value: stats.published,              icon: '◉' },
          { label: 'Total Views',    value: stats.views.toLocaleString(), icon: '👁' },
          { label: 'Words Written',  value: stats.words.toLocaleString(), icon: '⊡' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statIcon}>{s.icon}</span>
            <span className={styles.statValue}>{loading ? '—' : s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Main Editorial Feed Tabs */}
      <div className={styles.section}>
        <div className={styles.tabsBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'following' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('following')}
          >
            <span>Following</span>
            {followingArticles.length > 0 && <span className={styles.tabBadge}>{followingArticles.length}</span>}
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'discover' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            <span>Discover</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'bookmarks' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('bookmarks')}
          >
            <span>Reading List</span>
            {bookmarkedArticles.length > 0 && <span className={styles.tabBadge}>{bookmarkedArticles.length}</span>}
          </button>

          <button
            type="button"
            className={styles.feedSearchBtn}
            onClick={() => openGlobalSearch()}
            title="Search writers, articles, series, and communities (Ctrl+K)"
            aria-label="Search writers, articles, series, and communities"
          >
            <span>🔍</span>
            <span>Search</span>
            <kbd className={styles.feedSearchKbd}>Ctrl K</kbd>
          </button>
        </div>

        {/* Tab 1: Following Feed */}
        {activeTab === 'following' && (
          feedLoading ? (
            <div className={styles.feedGrid}>
              {[1, 2, 3].map(i => <div key={i} className={`skeleton ${styles.skeletonItem}`} />)}
            </div>
          ) : followingArticles.length === 0 ? (
            <div className={styles.emptyFeed}>
              <p>You aren&apos;t following any writers with recent stories yet.</p>
              <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={() => setActiveTab('discover')}>
                Explore Discover →
              </button>
            </div>
          ) : (
            <div className={styles.feedGrid}>
              {followingArticles.map(article => (
                <Link key={article.id} to={`/articles/${article.slug}`} className={styles.feedCard}>
                  <div className={styles.feedCardTop}>
                    <span className={styles.feedEmoji}>{article.cover_emoji || '✦'}</span>
                    <span className={styles.feedAuthor}>{article.author?.full_name || 'Writer'}</span>
                  </div>
                  <h3 className={styles.feedTitle}>{article.title || 'Untitled'}</h3>
                  <p className={styles.feedSummary}>{article.summary || article.content?.replace(/<[^>]*>/g, '').slice(0, 90) || '...'}</p>
                  <div className={styles.feedFoot}>
                    <span>{article.reading_time || 5} min read</span>
                    <span>{formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Tab 2: Discover Feed */}
        {activeTab === 'discover' && (
          feedLoading ? (
            <div className={styles.feedGrid}>
              {[1, 2, 3].map(i => <div key={i} className={`skeleton ${styles.skeletonItem}`} />)}
            </div>
          ) : discoverArticles.length === 0 ? (
            <div className={styles.emptyFeed}>
              <p>No community articles found yet.</p>
            </div>
          ) : (
            <div className={styles.feedGrid}>
              {discoverArticles.map(article => (
                <Link key={article.id} to={`/articles/${article.slug}`} className={styles.feedCard}>
                  <div className={styles.feedCardTop}>
                    <span className={styles.feedEmoji}>{article.cover_emoji || '✦'}</span>
                    <span className={styles.feedAuthor}>
                      {new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <h3 className={styles.feedTitle}>{article.title || 'Untitled'}</h3>
                  <p className={styles.feedSummary}>{article.summary || article.content?.replace(/<[^>]*>/g, '').slice(0, 90) || '...'}</p>
                  <div className={styles.feedFoot}>
                    <span>{article.reading_time || 5} min read</span>
                    <span>{(article.view_count || 0)} views</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Tab 3: Reading List (Bookmarks) */}
        {activeTab === 'bookmarks' && (
          feedLoading ? (
            <div className={styles.feedGrid}>
              {[1, 2, 3].map(i => <div key={i} className={`skeleton ${styles.skeletonItem}`} />)}
            </div>
          ) : bookmarkedArticles.length === 0 ? (
            <div className={styles.emptyFeed}>
              <p>Your Reading List is empty. Save inspiring stories to read them anytime.</p>
              <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={() => setActiveTab('discover')}>
                Browse Stories →
              </button>
            </div>
          ) : (
            <div className={styles.feedGrid}>
              {bookmarkedArticles.map(article => (
                <Link key={article.id} to={`/articles/${article.slug}`} className={styles.feedCard}>
                  <div className={styles.feedCardTop}>
                    <span className={styles.feedEmoji}>{article.cover_emoji || '✦'}</span>
                    <button
                      className={styles.removeBookmarkBtn}
                      onClick={e => handleRemoveBookmark(e, article.id)}
                      title="Remove from Reading List"
                    >
                      🔖
                    </button>
                  </div>
                  <h3 className={styles.feedTitle}>{article.title || 'Untitled'}</h3>
                  <p className={styles.feedSummary}>{article.summary || article.content?.replace(/<[^>]*>/g, '').slice(0, 90) || '...'}</p>
                  <div className={styles.feedFoot}>
                    <span>{article.reading_time || 5} min read</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Read story →</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>

      {/* Recent Writing (My Articles) */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Recent Writing</h2>
          <button className="btn btn-ghost" onClick={() => navigate('/app/articles')} style={{ fontSize: '12px', padding: '7px 14px' }}>
            View all →
          </button>
        </div>

        {loading ? (
          <div className={styles.skeletonList}>
            {[1, 2, 3].map(i => <div key={i} className={`skeleton ${styles.skeletonItem}`} />)}
          </div>
        ) : myArticles.length === 0 ? (
          <div className={styles.emptyFeed}>
            <p>Your canvas awaits. Start writing your first article.</p>
            <button className="btn btn-primary" onClick={() => navigate('/app/write')} style={{ marginTop: '10px' }}>
              Begin Writing
            </button>
          </div>
        ) : (
          <div className={styles.articleList}>
            {myArticles.map(article => (
              <div
                key={article.id}
                className={styles.articleRow}
                onClick={() => navigate(`/app/write/${article.id}`)}
              >
                <div className={styles.articleEmoji}>{article.cover_emoji || '✦'}</div>
                <div className={styles.articleInfo}>
                  <h3>{article.title || 'Untitled'}</h3>
                  <p>{article.summary || article.content?.replace(/<[^>]*>/g, '').slice(0, 80) || 'No content yet…'}</p>
                </div>
                <div className={styles.articleMeta}>
                  <span className={`tag tag-${article.status}`}>{article.status}</span>
                  <span className={styles.time}>
                    {formatDistanceToNow(new Date(article.updated_at), { addSuffix: true })}
                  </span>
                </div>
                {article.status === 'published' && article.slug && (
                  <a
                    className={styles.viewLive}
                    href={`/articles/${article.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    title="View live article"
                  >
                    ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
