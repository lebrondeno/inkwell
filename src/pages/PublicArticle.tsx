import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase, getWriterProfile, incrementView } from '../lib/supabase'
import Footer from '../components/Footer'
import { useApp } from '../context/AppContext'
import type { Article } from '../lib/supabase'
import styles from './PublicArticle.module.css'

export default function PublicArticle() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useApp()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [authorName, setAuthorName] = useState('Anonymous')
  const [authorBio, setAuthorBio] = useState('')
  const [authorInitials, setAuthorInitials] = useState('?')

  useEffect(() => { loadArticle() }, [slug])

  const loadArticle = async () => {
    try {
      // NOTE: Supabase RLS must allow "status = 'published'" reads for anon users.
      // See supabase-schema.sql — policy: "Public can view published articles"
      const { data, error: err } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single()

      if (err || !data) {
        setError('not_found')
        setLoading(false)
        return
      }

      setArticle(data)

      // Increment view count (fire-and-forget)
      if (slug) incrementView(slug)

      // Fetch author from writer_profiles (public table)
      const profile = await getWriterProfile(data.user_id)
      if (profile && (profile.full_name || profile.bio)) {
        const name = profile.full_name || 'Writer'
        setAuthorName(name)
        setAuthorBio(profile.bio || '')
        setAuthorInitials(name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '✦')
      }
    } catch {
      setError('error')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.fullscreen}>
          <div className={styles.loadSpinner}>✦</div>
          <p className={styles.loadText}>Loading article…</p>
        </div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className={styles.wrapper}>
        <nav className={styles.topNav}>
          <Link to="/discover" className={styles.backBtn}>← Discover</Link>
          <span className={styles.navLogo}>✦ Inkwell</span>
          <button className={styles.themeBtn} onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
        </nav>
        <div className={styles.fullscreen}>
          <div className={styles.errorEmoji}>📄</div>
          <h2 className={styles.errorTitle}>Article not found</h2>
          <p className={styles.errorSub}>
            {error === 'not_found'
              ? 'This article may not be published or the link is incorrect.'
              : 'Something went wrong loading this article.'}
          </p>
          <p className={styles.errorHint}>
            💡 <strong>If you're the author:</strong> make sure the article is set to <em>Published</em> in your editor, and that the Supabase RLS policy allows public reads of published articles (see <code>supabase-schema.sql</code>).
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/discover')}>
            ← Back to Discover
          </button>
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
      {/* ── Top nav ── */}
      <nav className={styles.topNav}>
        <Link to="/discover" className={styles.backBtn}>← Discover</Link>
        <span className={styles.navLogo}>✦ Inkwell</span>
        <div className={styles.navActions}>
          <button className={styles.themeBtn} onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ''}`}
            onClick={copyLink}
          >
            {copied ? '✓ Copied!' : '🔗 Share'}
          </button>
        </div>
      </nav>

      <div className={styles.container}>
        <article className={styles.article}>

          {/* ── Hero ── */}
          <div className={styles.hero}>
            <span className={styles.emoji}>{article.cover_emoji || '✦'}</span>
            <h1 className={styles.title}>{article.title}</h1>
          </div>

          {/* ── Author + meta ── */}
          <Link to={`/writer/${article.user_id}`} className={styles.authorRow}>
            <div className={styles.authorAvatar}>{authorInitials}</div>
            <div className={styles.authorMeta}>
              <span className={styles.authorName}>{authorName}</span>
              <span className={styles.authorSub}>
                {publishedDate}
                {article.reading_time ? ` · ${article.reading_time} min read` : ''}
                {article.view_count ? ` · ${article.view_count} views` : ''}
              </span>
            </div>
            <span className={styles.profilePill}>View profile →</span>
          </Link>

          {/* ── Tags ── */}
          {article.tags && article.tags.length > 0 && (
            <div className={styles.tags}>
              {article.tags.map((tag: string) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}

          <div className={styles.divider} />

          {/* ── Body ── */}
          <div className={styles.body}>
            {article.content?.split('\n').map((para, idx) =>
              para.trim()
                ? <p key={idx} className={styles.paragraph}>{para}</p>
                : <div key={idx} style={{ height: '12px' }} />
            )}
          </div>

          {/* ── Share card ── */}
          <div className={styles.shareCard}>
            <div className={styles.shareCardTop}>
              <span className={styles.shareCardTitle}>📋 Share this article</span>
              <button
                className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
                onClick={copyLink}
              >
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
            <input
              readOnly
              value={window.location.href}
              className={styles.linkInput}
              onFocus={e => { e.target.select(); copyLink() }}
              title="Click to copy"
            />
          </div>

          {/* ── Author bio card ── */}
          <Link to={`/writer/${article.user_id}`} className={styles.authorCard}>
            <div className={styles.authorCardAvatar}>{authorInitials}</div>
            <div className={styles.authorCardInfo}>
              <p className={styles.authorCardName}>{authorName}</p>
              {authorBio
                ? <p className={styles.authorCardBio}>{authorBio}</p>
                : <p className={styles.authorCardBio}>Inkwell writer</p>
              }
            </div>
            <span className={styles.authorCardArrow}>→</span>
          </Link>

        </article>
      </div>
      <Footer />
    </div>
  )
}
