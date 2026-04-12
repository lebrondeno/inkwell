import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Footer from '../components/Footer'
import type { Article } from '../lib/supabase'
import styles from './PublicProfile.module.css'

interface WriterProfile {
  full_name: string
  bio: string
  username: string
}

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<WriterProfile | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadWriter() }, [userId])

  const loadWriter = async () => {
    try {
      // Try profiles table first
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, bio, username')
        .eq('id', userId)
        .single()

      if (profileData) {
        setProfile(profileData)
      } else {
        setProfile({ full_name: 'Writer', bio: '', username: '' })
      }

      // Load published articles
      const { data: arts } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })

      setArticles(arts || [])
    } catch {
      setProfile({ full_name: 'Writer', bio: '', username: '' })
    } finally {
      setLoading(false)
    }
  }

  const displayName = profile?.full_name || profile?.username || 'Writer'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}><span className={styles.loadIcon}>✦</span><p>Loading writer…</p></div>
        <Footer />
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <nav className={styles.topNav}>
        <button className={styles.backBtn} onClick={() => navigate('/discover')}>← Discover</button>
        <span className={styles.navLogo}>✦ Inkwell</span>
        <div />
      </nav>

      <div className={styles.container}>
        {/* Writer hero */}
        <div className={styles.profileHero}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.profileInfo}>
            <h1 className={styles.name}>{displayName}</h1>
            {profile?.bio && <p className={styles.bio}>{profile.bio}</p>}
            <div className={styles.stats}>
              <span className={styles.statItem}><strong>{articles.length}</strong> published articles</span>
              <span className={styles.statItem}>
                <strong>{articles.reduce((s, a) => s + (a.word_count || 0), 0).toLocaleString()}</strong> words
              </span>
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Articles */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Published Articles</h2>
          {articles.length === 0 ? (
            <div className={styles.empty}>
              <p>No published articles yet.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {articles.map((article) => (
                <Link key={article.id} to={`/articles/${article.slug}`} className={styles.card}>
                  <div className={styles.cardTop}>
                    <span className={styles.cardEmoji}>{article.cover_emoji || '✦'}</span>
                    <span className={styles.cardDate}>{new Date(article.created_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className={styles.cardTitle}>{article.title}</h3>
                  {article.tags && article.tags.length > 0 && (
                    <div className={styles.cardTags}>
                      {article.tags.slice(0, 3).map((t: string) => (
                        <span key={t} className={styles.cardTag}>{t}</span>
                      ))}
                    </div>
                  )}
                  <div className={styles.cardFooter}>
                    <span>{article.reading_time || 5} min read</span>
                    <span>{article.word_count || 0} words</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
