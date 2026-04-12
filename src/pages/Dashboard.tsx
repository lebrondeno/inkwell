import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatDistanceToNow } from 'date-fns'
import type { Article } from '../lib/supabase'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'Writer'

  useEffect(() => {
    fetchArticles()
  }, [])

  const fetchArticles = async () => {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false })
      .limit(5)
    setArticles(data || [])
    setLoading(false)
  }

  const stats = {
    total: articles.length,
    published: articles.filter(a => a.status === 'published').length,
    drafts: articles.filter(a => a.status === 'draft').length,
    words: articles.reduce((sum, a) => sum + (a.word_count || 0), 0),
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
          { label: 'Total Articles', value: stats.total, icon: '◈' },
          { label: 'Published', value: stats.published, icon: '◉' },
          { label: 'Drafts', value: stats.drafts, icon: '◎' },
          { label: 'Words Written', value: stats.words.toLocaleString(), icon: '⊡' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statIcon}>{s.icon}</span>
            <span className={styles.statValue}>{loading ? '—' : s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Recent articles */}
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
        ) : articles.length === 0 ? (
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
            {articles.map((article, i) => (
              <div
                key={article.id}
                className={styles.articleRow}
                onClick={() => navigate(`/app/write/${article.id}`)}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className={styles.articleEmoji}>{article.cover_emoji || '✦'}</div>
                <div className={styles.articleInfo}>
                  <h3>{article.title || 'Untitled'}</h3>
                  <p>{article.summary || article.content?.substring(0, 80) || 'No content yet...'}</p>
                </div>
                <div className={styles.articleMeta}>
                  <span className={`tag tag-${article.status}`}>{article.status}</span>
                  <span className={styles.time}>
                    {formatDistanceToNow(new Date(article.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
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
