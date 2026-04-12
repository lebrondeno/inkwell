import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import Footer from '../components/Footer'
import type { Article } from '../lib/supabase'
import styles from './PublicDiscover.module.css'

type Tab = 'latest' | 'trending'

export default function PublicDiscover() {
  const navigate = useNavigate()
  const { user, theme, toggleTheme } = useApp()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('latest')

  useEffect(() => { loadArticles() }, [])

  const loadArticles = async () => {
    try {
      // Works because RLS policy allows anon reads of published articles
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(80)

      if (error) console.error('Discover load error:', error.message)
      setArticles(data || [])
    } catch (e) {
      console.error('Discover error:', e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Trending: sort by view_count desc, fallback to word_count
  const trending = [...filtered].sort((a, b) =>
    (b.view_count || b.word_count || 0) - (a.view_count || a.word_count || 0)
  )

  const displayed = activeTab === 'trending' ? trending : filtered

  return (
    <div className={styles.wrapper}>
      {/* ── Top Nav ── */}
      <nav className={styles.topNav}>
        <Link to="/" className={styles.navLogo}>
          <span>✦</span> Inkwell
        </Link>
        <div className={styles.navRight}>
          <button className={styles.themeBtn} onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {user ? (
            <button className="btn btn-primary" onClick={() => navigate('/app')} style={{ fontSize: '13px', padding: '7px 14px' }}>
              Dashboard →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => navigate('/')} style={{ fontSize: '13px', padding: '7px 14px' }}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      <div className={styles.container}>
        {/* ── Header ── */}
        <div className={styles.hero}>
          <div>
            <h1 className={styles.title}>✦ Discover Stories</h1>
            <p className={styles.subtitle}>
              {user
                ? 'Welcome back — see what the community has been writing.'
                : 'Explore published stories from writers on Inkwell.'}
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate(user ? '/app/write' : '/')}
            style={{ flexShrink: 0 }}
          >
            ✍️ {user ? 'Write Article' : 'Start Writing'}
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'latest' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('latest')}
          >
            ◉ Latest
          </button>

          {user ? (
            <button
              className={`${styles.tab} ${activeTab === 'trending' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('trending')}
            >
              🔥 Trending
            </button>
          ) : (
            <button
              className={`${styles.tab} ${styles.tabGated}`}
              onClick={() => navigate('/')}
              title="Sign in to see trending"
            >
              🔥 Trending
              <span className={styles.gatedBadge}>Sign in</span>
            </button>
          )}
        </div>

        {/* ── Search ── */}
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            type="text"
            placeholder="Search by title or tag…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button className={styles.clearBtn} onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        {/* ── Count ── */}
        {!loading && (
          <p className={styles.resultCount}>
            {displayed.length === 0 ? 'No articles found' : `${displayed.length} article${displayed.length === 1 ? '' : 's'}`}
            {activeTab === 'trending' && ' · sorted by popularity'}
          </p>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div className={styles.grid}>
            {[1,2,3,4,5,6].map(i => <div key={i} className={`skeleton ${styles.skeletonCard}`} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>✦</span>
            <p>No articles here yet</p>
            <small>Check back later or broaden your search</small>
          </div>
        ) : (
          <div className={styles.grid}>
            {displayed.map((article, i) => (
              <article
                key={article.id}
                className={styles.card}
                onClick={() => navigate(`/articles/${article.slug}`)}
                style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}
              >
                {activeTab === 'trending' && i < 3 && (
                  <div className={styles.trendRank}>#{i + 1}</div>
                )}
                <div className={styles.cardHead}>
                  <span className={styles.cardEmoji}>{article.cover_emoji || '✦'}</span>
                  <span className={styles.cardDate}>
                    {new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <h2 className={styles.cardTitle}>{article.title}</h2>
                {article.tags && article.tags.length > 0 && (
                  <div className={styles.cardTags}>
                    {article.tags.slice(0, 3).map((t: string) => (
                      <span key={t} className={styles.cardTag}>{t}</span>
                    ))}
                  </div>
                )}
                <div className={styles.cardFoot}>
                  <span>📖 {article.reading_time || 5} min</span>
                  <span>{(article.word_count || 0).toLocaleString()} words</span>
                  {(article.view_count || 0) > 0 && (
                    <span>{article.view_count} views</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
