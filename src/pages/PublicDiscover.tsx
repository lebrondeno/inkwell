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
      const { data } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(60)
      setArticles(data || [])
    } catch {
      console.error('Failed to load articles')
    } finally {
      setLoading(false)
    }
  }

  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Trending = sorted by word count as proxy for popular (could use views if available)
  const trending = [...filtered].sort((a, b) => (b.word_count || 0) - (a.word_count || 0))
  const displayed = activeTab === 'trending' ? trending : filtered

  return (
    <div className={styles.wrapper}>
      {/* Top Nav */}
      <nav className={styles.topNav}>
        <Link to="/" className={styles.navLogo}>
          <span className={styles.navMark}>✦</span>
          <span>Inkwell</span>
        </Link>
        <div className={styles.navRight}>
          <button className={styles.themeBtn} onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {user ? (
            <button className="btn btn-primary" onClick={() => navigate('/app')} style={{ fontSize: '13px', padding: '8px 16px' }}>
              Dashboard →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => navigate('/')} style={{ fontSize: '13px', padding: '8px 16px' }}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      <div className={styles.container}>
        {/* Header */}
        <div className={styles.hero}>
          <div>
            <h1 className={styles.title}>✦ Discover Stories</h1>
            <p className={styles.subtitle}>
              {user ? `Welcome back! Browse what the community is writing.` : 'Explore published stories from writers worldwide.'}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate(user ? '/app/write' : '/')} style={{ flexShrink: 0 }}>
            ✍️ {user ? 'Write Article' : 'Start Writing Free'}
          </button>
        </div>

        {/* Tabs — trending only for logged-in */}
        <div className={styles.tabRow}>
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
              className={`${styles.tab} ${styles.tabLocked}`}
              title="Sign in to see trending articles"
              onClick={() => navigate('/')}
            >
              🔥 Trending <span className={styles.lockBadge}>Sign in</span>
            </button>
          )}
        </div>

        {/* Search */}
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
            <button className={styles.clearSearch} onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className={styles.skeletons}>
            {[1,2,3,4,5,6].map(i => <div key={i} className={`skeleton ${styles.skeletonCard}`} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyIcon}>✦</p>
            <p>No articles found</p>
            <small>Check back later or try a different search</small>
          </div>
        ) : (
          <div className={styles.grid}>
            {displayed.map((article, i) => (
              <article
                key={article.id}
                className={styles.card}
                onClick={() => navigate(`/articles/${article.slug}`)}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardEmoji}>{article.cover_emoji || '✦'}</span>
                  <span className={styles.cardDate}>{new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <h2 className={styles.cardTitle}>{article.title}</h2>
                {article.tags && article.tags.length > 0 && (
                  <div className={styles.cardTags}>
                    {article.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} className={styles.cardTag}>{tag}</span>
                    ))}
                  </div>
                )}
                <div className={styles.cardFooter}>
                  <span className={styles.footerItem}>📖 {article.reading_time || 5} min</span>
                  <span className={styles.footerItem}>✍ {(article.word_count || 0).toLocaleString()} words</span>
                  {activeTab === 'trending' && (
                    <span className={styles.trendingBadge}>🔥 Trending</span>
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
