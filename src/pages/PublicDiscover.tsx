import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Footer from '../components/Footer'
import type { Article } from '../lib/supabase'
import styles from './PublicDiscover.module.css'

export default function PublicDiscover() {
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadArticles()
  }, [])

  const loadArticles = async () => {
    try {
      const { data } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50)

      setArticles(data || [])
    } catch (err) {
      console.error('Failed to load articles')
    } finally {
      setLoading(false)
    }
  }

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>✦ Discover Articles</h1>
            <p className={styles.subtitle}>Explore published stories from our community</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/app/write')}>
            ✍️ Write Article
          </button>
        </div>

        {/* Search */}
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search by title or tags..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Articles grid */}
        {loading ? (
          <div className={styles.loadingState}>✦ Loading articles...</div>
        ) : filteredArticles.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No articles found</p>
            <small>Check back later for new stories</small>
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredArticles.map(article => (
              <article
                key={article.id}
                className={styles.card}
                onClick={() => navigate(`/articles/${article.slug}`)}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardEmoji}>{article.cover_emoji || '✦'}</span>
                  <span className={styles.cardTime}>
                    {new Date(article.created_at).toLocaleDateString()}
                  </span>
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
                  <span className={styles.readingTime}>{article.reading_time || 5} min read</span>
                  <span className={styles.wordCount}>{article.word_count || 0} words</span>
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
