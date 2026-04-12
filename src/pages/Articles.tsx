import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatDistanceToNow } from 'date-fns'
import type { Article, ArticleStatus } from '../lib/supabase'
import styles from './Articles.module.css'

const FILTERS: { label: string; value: ArticleStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Published', value: 'published' },
  { label: 'Drafts', value: 'draft' },
  { label: 'Archived', value: 'archived' },
]

export default function Articles() {
  const { user, showToast } = useApp()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ArticleStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchArticles() }, [])

  const fetchArticles = async () => {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false })
    setArticles(data || [])
    setLoading(false)
  }

  const deleteArticle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this article?')) return
    await supabase.from('articles').delete().eq('id', id)
    setArticles(prev => prev.filter(a => a.id !== id))
    showToast('Article deleted')
  }

  const filtered = articles.filter(a => {
    const matchFilter = filter === 'all' || a.status === filter
    const matchSearch = !search || 
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.content?.toLowerCase().includes(search.toLowerCase()) ||
      a.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    return matchFilter && matchSearch
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>My Articles</h1>
          <p>{articles.length} pieces of writing</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/app/write')}>
          ✦ New Article
        </button>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.filters}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              className={`${styles.filterBtn} ${filter === f.value ? styles.active : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className={styles.count}>
                {f.value === 'all' ? articles.length : articles.filter(a => a.status === f.value).length}
              </span>
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          placeholder="Search articles..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: '240px' }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className={styles.grid}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className={`skeleton ${styles.skeletonCard}`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>◈</span>
          <h3>{search ? 'No results found' : 'Nothing here yet'}</h3>
          <p>{search ? 'Try a different search' : 'Start writing your first article'}</p>
          {!search && (
            <button className="btn btn-primary" onClick={() => navigate('/app/write')}>
              Begin Writing
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((article, i) => (
            <div
              key={article.id}
              className={styles.card}
              onClick={() => navigate(`/app/write/${article.id}`)}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className={styles.cardTop}>
                <span className={styles.emoji}>{article.cover_emoji || '✦'}</span>
                <button
                  className={styles.deleteBtn}
                  onClick={e => deleteArticle(article.id, e)}
                  title="Delete"
                >
                  ✕
                </button>
              </div>

              <h2 className={styles.cardTitle}>{article.title || 'Untitled'}</h2>

              <p className={styles.cardExcerpt}>
                {article.summary || article.content?.substring(0, 120) || 'No content yet...'}
              </p>

              <div className={styles.cardFooter}>
                <div className={styles.cardTags}>
                  {article.tags?.slice(0,2).map(t => (
                    <span key={t} className={styles.cardTag}>#{t}</span>
                  ))}
                </div>
                <div className={styles.cardMeta}>
                  <span className={`tag tag-${article.status}`}>{article.status}</span>
                  <span className={styles.cardTime}>
                    {formatDistanceToNow(new Date(article.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {article.word_count > 0 && (
                <div className={styles.cardStats}>
                  <span>{article.word_count} words</span>
                  <span>·</span>
                  <span>{article.reading_time} min read</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
