import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase, getWriterProfile } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import Footer from '../components/Footer'
import type { Article } from '../lib/supabase'
import styles from './PublicProfile.module.css'

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useApp()
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => { if (userId) loadWriter(userId) }, [userId])

  const loadWriter = async (uid: string) => {
    try {
      const profile = await getWriterProfile(uid)

      // Load published articles regardless of whether profile exists
      const { data } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'published')
        .order('created_at', { ascending: false })

      const arts = data || []

      if (!profile && arts.length === 0) {
        setNotFound(true)
      } else {
        if (profile?.full_name) setFullName(profile.full_name)
        if (profile?.bio) setBio(profile.bio)
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
        setArticles(arts)
      }
    } catch (e) {
      console.error('Profile load error:', e)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const displayName = fullName || 'Inkwell Writer'
  const initials = displayName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '✦'
  const totalWords = articles.reduce((s, a) => s + (a.word_count || 0), 0)
  const totalViews = articles.reduce((s, a) => s + (a.view_count || 0), 0)

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.center}>
          <span className={styles.spinner}>✦</span>
          <p>Loading writer…</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={styles.wrapper}>
        <nav className={styles.topNav}>
          <button className={styles.backBtn} onClick={() => navigate('/discover')}>← Discover</button>
          <span className={styles.navLogo}>✦ Inkwell</span>
          <button className={styles.themeBtn} onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
        </nav>
        <div className={styles.center}>
          <span style={{ fontSize: '48px' }}>✦</span>
          <h2 style={{ marginTop: '16px' }}>Writer not found</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>This profile doesn't exist or has no published content yet.</p>
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => navigate('/discover')}>← Back to Discover</button>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <nav className={styles.topNav}>
        <button className={styles.backBtn} onClick={() => navigate('/discover')}>← Discover</button>
        <span className={styles.navLogo}>✦ Inkwell</span>
        <button className={styles.themeBtn} onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
      </nav>

      <div className={styles.container}>
        {/* ── Profile hero ── */}
        <div className={styles.profileHero}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className={styles.avatarImage} />
          ) : (
            <div className={styles.avatar}>{initials}</div>
          )}
          <div className={styles.profileInfo}>
            <h1 className={styles.name}>{displayName}</h1>
            {bio && <p className={styles.bio}>{bio}</p>}
            <div className={styles.statRow}>
              <span className={styles.stat}><strong>{articles.length}</strong> article{articles.length !== 1 ? 's' : ''}</span>
              {totalWords > 0 && (
                <>
                  <span className={styles.statDot}>·</span>
                  <span className={styles.stat}><strong>{totalWords.toLocaleString()}</strong> words</span>
                </>
              )}
              {totalViews > 0 && (
                <>
                  <span className={styles.statDot}>·</span>
                  <span className={styles.stat}><strong>{totalViews.toLocaleString()}</strong> views</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        {/* ── Articles ── */}
        <h2 className={styles.sectionTitle}>Published Articles</h2>

        {articles.length === 0 ? (
          <div className={styles.empty}>
            <span>✦</span>
            <p>No published articles yet.</p>
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
                <div className={styles.cardHead}>
                  <span className={styles.cardEmoji}>{article.cover_emoji || '✦'}</span>
                  <span className={styles.cardDate}>
                    {new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <h3 className={styles.cardTitle}>{article.title}</h3>
                {article.tags && article.tags.length > 0 && (
                  <div className={styles.cardTags}>
                    {article.tags.slice(0, 3).map((t: string) => (
                      <span key={t} className={styles.cardTag}>{t}</span>
                    ))}
                  </div>
                )}
                <div className={styles.cardFoot}>
                  <span>{article.reading_time || 5} min read</span>
                  <span>{(article.word_count || 0).toLocaleString()} words</span>
                  {(article.view_count || 0) > 0 && <span>{article.view_count} views</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
