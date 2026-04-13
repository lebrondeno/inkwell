import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getUserBookmarks } from '../lib/supabase'
import type { Article } from '../lib/supabase'
import styles from './Bookmarks.module.css'

export default function Bookmarks() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (user) getUserBookmarks(user.id).then(data => { setArticles(data); setLoading(false) })
  }, [user])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>🔖 Saved Articles</h1>
          <p>{articles.length} bookmark{articles.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/discover')} style={{ fontSize: '12px' }}>
          ⟡ Discover more →
        </button>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {[1,2,3].map(i => <div key={i} className={`skeleton ${styles.skeletonCard}`} />)}
        </div>
      ) : articles.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔖</span>
          <h3>No saved articles yet</h3>
          <p>Bookmark articles you want to read later while browsing Discover.</p>
          <button className="btn btn-primary" onClick={() => navigate('/discover')}>Browse Articles</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {articles.map((article, i) => (
            <Link
              key={article.id}
              to={`/articles/${article.slug}`}
              className={styles.card}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className={styles.cardTop}>
                <span className={styles.cardEmoji}>{article.cover_emoji || '✦'}</span>
                <span className={styles.cardDate}>
                  {new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <h2 className={styles.cardTitle}>{article.title}</h2>
              {article.tags?.length > 0 && (
                <div className={styles.cardTags}>
                  {article.tags.slice(0, 3).map(t => <span key={t} className={styles.cardTag}>{t}</span>)}
                </div>
              )}
              <div className={styles.cardFoot}>
                <span>{article.reading_time || 5} min read</span>
                {(article.view_count || 0) > 0 && <span>👁 {article.view_count}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
