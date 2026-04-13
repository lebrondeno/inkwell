import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatDistanceToNow } from 'date-fns'
import type { Article } from '../lib/supabase'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [myArticles, setMyArticles] = useState<Article[]>([])
  const [community, setCommunity] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [communityLoading, setCommunityLoading] = useState(true)
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'Writer'

  useEffect(() => {
    if (!user?.id) {
      setMyArticles([])
      setCommunity([])
      setLoading(false)
      setCommunityLoading(false)
      return
    }
    fetchMyArticles(user.id)
    fetchCommunity(user.id)
  }, [user?.id])

  const fetchMyArticles = async (userId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5)
    setMyArticles(data || [])
    setLoading(false)
  }

  const fetchCommunity = async (userId: string) => {
    setCommunityLoading(true)
    // Fetch latest published articles from ALL writers (not just current user)
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .neq('user_id', userId)          // exclude own articles
      .order('created_at', { ascending: false })
      .limit(4)
    setCommunity(data || [])
    setCommunityLoading(false)
  }

  const stats = {
    total:     myArticles.length,
    published: myArticles.filter(a => a.status === 'published').length,
    drafts:    myArticles.filter(a => a.status === 'draft').length,
    words:     myArticles.reduce((sum, a) => sum + (a.word_count || 0), 0),
    views:     myArticles.reduce((sum, a) => sum + (a.view_count || 0), 0),
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.greeting}>{greeting}</p>
          <h1 className={styles.title}>{displayName}</h1>
          <p className={styles.sub}>What will you write today?</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/app/write')}>
          ✦ New Article
        </button>
      </div>

      {/* Stats */}
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

      {/* Recent writing */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Recent Writing</h2>
          <button className="btn btn-ghost" onClick={() => navigate('/app/articles')} style={{ fontSize: '12px', padding: '7px 14px' }}>
            View all →
          </button>
        </div>

        {loading ? (
          <div className={styles.skeletonList}>
            {[1,2,3].map(i => <div key={i} className={`skeleton ${styles.skeletonItem}`} />)}
          </div>
        ) : myArticles.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✦</div>
            <h3>Your canvas awaits</h3>
            <p>Start writing your first article. No rules, no limits.</p>
            <button className="btn btn-primary" onClick={() => navigate('/app/write')}>
              Begin Writing
            </button>
          </div>
        ) : (
          <div className={styles.articleList}>
            {myArticles.map((article, i) => (
              <div
                key={article.id}
                className={styles.articleRow}
                onClick={() => navigate(`/app/write/${article.id}`)}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className={styles.articleEmoji}>{article.cover_emoji || '✦'}</div>
                <div className={styles.articleInfo}>
                  <h3>{article.title || 'Untitled'}</h3>
                  <p>{article.summary || article.content?.substring(0, 80) || 'No content yet…'}</p>
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

      {/* Community section — articles from other writers */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>✦ From the Community</h2>
          <button className="btn btn-ghost" onClick={() => navigate('/discover')} style={{ fontSize: '12px', padding: '7px 14px' }}>
            Discover all →
          </button>
        </div>

        {communityLoading ? (
          <div className={styles.communityGrid}>
            {[1,2,3,4].map(i => <div key={i} className={`skeleton ${styles.communitySkeletonCard}`} />)}
          </div>
        ) : community.length === 0 ? (
          <div className={styles.communityEmpty}>
            <p>No community articles yet. Be the first to publish!</p>
            <button className="btn btn-ghost" style={{ fontSize: '12px', marginTop: '10px' }} onClick={() => navigate('/app/write')}>
              Start Writing →
            </button>
          </div>
        ) : (
          <div className={styles.communityGrid}>
            {community.map((article, i) => (
              <Link
                key={article.id}
                to={`/articles/${article.slug}`}
                className={styles.communityCard}
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className={styles.communityCardTop}>
                  <span className={styles.communityEmoji}>{article.cover_emoji || '✦'}</span>
                  <span className={styles.communityDate}>
                    {new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <h3 className={styles.communityTitle}>{article.title || 'Untitled'}</h3>
                <div className={styles.communityFoot}>
                  <span>{article.reading_time || 5} min read</span>
                  {(article.view_count || 0) > 0 && <span>{article.view_count} views</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Start from a prompt</h2>
        </div>
        <div className={styles.prompts}>
          {[
            { emoji: '🕯️', text: 'A reflection on something I learned recently' },
            { emoji: '🌿', text: 'What peace means to me right now' },
            { emoji: '✍️', text: 'A letter to my future self' },
            { emoji: '🔥', text: 'The moment everything changed' },
          ].map(p => (
            <button
              key={p.text}
              className={styles.prompt}
              onClick={() => navigate('/app/write', { state: { prompt: p.text } })}
            >
              <span>{p.emoji}</span>
              <span>{p.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
