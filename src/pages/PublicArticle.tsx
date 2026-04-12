import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
  const [copied, setCopied] = useState(false)
  const [authorName, setAuthorName] = useState<string>('Anonymous')
  const [authorBio, setAuthorBio] = useState<string>('')
  const [authorInitials, setAuthorInitials] = useState<string>('?')

  useEffect(() => { loadArticle() }, [slug])

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

      // Fetch author profile from profiles table (public, no admin needed)
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, bio, username')
        .eq('id', data.user_id)
        .single()

      if (profile) {
        const name = profile.full_name || profile.username || 'Anonymous'
        setAuthorName(name)
        setAuthorBio(profile.bio || '')
        setAuthorInitials(name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2))
      }
    } catch {
      setError('Failed to load article')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner}>✦</div>
          <p>Loading article…</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>✦</div>
            <h2>Article not found</h2>
            <p>This article may have been removed or is not yet published.</p>
            <button className="btn btn-primary" onClick={() => navigate('/discover')}>
              ← Back to Discover
            </button>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const publishedDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className={styles.wrapper}>
      {/* Top nav bar */}
      <nav className={styles.topNav}>
        <Link to="/discover" className={styles.backBtn}>
          <span>←</span> Discover
        </Link>
        <span className={styles.navLogo}>✦ Inkwell</span>
        <button className={`${styles.copyBtn} ${copied ? styles.copiedBtn : ''}`} onClick={copyLink}>
          {copied ? '✓ Copied!' : '🔗 Share'}
        </button>
      </nav>

      <div className={styles.container}>
        <article className={styles.article}>
          {/* Hero */}
          <div className={styles.hero}>
            <span className={styles.emoji}>{article.cover_emoji || '✦'}</span>
            <h1 className={styles.title}>{article.title}</h1>
          </div>

          {/* Meta row */}
          <div className={styles.metaRow}>
            {/* Author card (clickable — public profile) */}
            <Link to={`/writer/${article.user_id}`} className={styles.authorCard}>
              <div className={styles.authorAvatar}>{authorInitials}</div>
              <div className={styles.authorInfo}>
                <span className={styles.authorName}>{authorName}</span>
                {authorBio && <span className={styles.authorBio}>{authorBio}</span>}
              </div>
            </Link>

            <div className={styles.metaRight}>
              <span className={styles.metaDate}>{publishedDate}</span>
              {article.reading_time && (
                <span className={styles.metaRead}>{article.reading_time} min read</span>
              )}
            </div>
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className={styles.tags}>
              {article.tags.map((tag: string) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}

          <div className={styles.divider} />

          {/* Body */}
          <div className={styles.body}>
            {article.content?.split('\n').map((para, idx) =>
              para.trim() ? (
                <p key={idx} className={styles.paragraph}>{para}</p>
              ) : (
                <div key={idx} className={styles.spacer} />
              )
            )}
          </div>

          {/* Share section */}
          <div className={styles.shareSection}>
            <p className={styles.shareLabel}>Enjoyed this piece? Share it.</p>
            <div className={styles.shareRow}>
              <div className={styles.linkBox}>
                <input
                  readOnly
                  value={window.location.href}
                  className={styles.linkInput}
                  onFocus={e => e.target.select()}
                />
              </div>
              <button className={`${styles.shareCopyBtn} ${copied ? styles.shareCopied : ''}`} onClick={copyLink}>
                {copied ? '✓ Copied' : '📋 Copy Link'}
              </button>
            </div>
          </div>

          {/* Author bio card */}
          <div className={styles.authorBioCard}>
            <Link to={`/writer/${article.user_id}`} className={styles.authorBigCard}>
              <div className={styles.authorBigAvatar}>{authorInitials}</div>
              <div>
                <p className={styles.authorBigName}>{authorName}</p>
                {authorBio && <p className={styles.authorBigBio}>{authorBio}</p>}
                <span className={styles.authorProfileLink}>View profile →</span>
              </div>
            </Link>
          </div>
        </article>
      </div>

      <Footer />
    </div>
  )
}
