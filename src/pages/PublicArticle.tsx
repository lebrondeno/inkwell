import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Footer from '../components/Footer'
import type { Article } from '../lib/supabase'
import styles from './PublicArticle.module.css'

export default function PublicArticle() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [author, setAuthor] = useState<{ email: string; full_name?: string } | null>(null)

  useEffect(() => {
    loadArticle()
  }, [slug])

  const loadArticle = async () => {
    try {
      const { data, error: err } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single()

      if (err || !data) {
        setError('Article not found')
        setLoading(false)
        return
      }

      setArticle(data)

      // Get author info
      const { data: userData } = await supabase.auth.admin.getUserById(data.user_id)
      if (userData?.user) {
        setAuthor({
          email: userData.user.email || '',
          full_name: userData.user.user_metadata?.full_name
        })
      }
    } catch (err) {
      setError('Failed to load article')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>✦ Loading...</div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h2>Article not found</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/discover')}>
            ← Back to Articles
          </button>
        </div>
      </div>
    )
  }

  const publishedDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {/* Header with back button */}
        <button className={styles.backBtn} onClick={() => navigate('/discover')}>
          ← Back to Articles
        </button>

        {/* Article content */}
        <article className={styles.article}>
          {/* Cover emoji + title */}
          <div className={styles.cover}>
            <span className={styles.emoji}>{article.cover_emoji || '✦'}</span>
            <h1 className={styles.title}>{article.title}</h1>
          </div>

          {/* Article meta */}
          <div className={styles.meta}>
            <div className={styles.metaLeft}>
              <span className={styles.author}>
                by <strong>{author?.full_name || author?.email?.split('@')[0] || 'Anonymous'}</strong>
              </span>
              <span className={styles.date}>{publishedDate}</span>
              {article.reading_time && (
                <>
                  <span className={styles.separator}>·</span>
                  <span className={styles.readingTime}>{article.reading_time} min read</span>
                </>
              )}
            </div>
            {article.tags && article.tags.length > 0 && (
              <div className={styles.tags}>
                {article.tags.map((tag: string) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className={styles.divider} />

          {/* Article body */}
          <div className={styles.body}>
            {article.content?.split('\n').map((para, idx) => (
              para.trim() && (
                <p key={idx} className={styles.paragraph}>
                  {para}
                </p>
              )
            ))}
          </div>

          {/* Share section */}
          <div className={styles.share}>
            <button
              className={styles.shareBtn}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
              }}
            >
              📋 Copy Link
            </button>
          </div>
        </article>
      </div>

      <Footer />
    </div>
  )
}
