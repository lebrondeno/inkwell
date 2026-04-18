import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getCommunities } from '../../lib/supabase'
import type { Community } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import VerseOfDay from '../../components/VerseOfDay'
import PublicNav from '../../components/PublicNav'
import styles from './Communities.module.css'

const CATEGORIES = ['All', 'Church', 'Bible Study', 'Devotionals', 'Prayer', 'Youth', 'General']

export default function Communities() {
  const navigate = useNavigate()
  const { user, showToast } = useApp()
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', emoji: '🏛️', category: 'General' })
  const gridRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { load() }, [])

  const filtered = communities.filter(c => {
    const matchCat = filter === 'All' || c.category === filter
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  useEffect(() => {
    if (loading || !gridRef.current) return
    const cards = Array.from(gridRef.current.querySelectorAll<HTMLElement>(`.${styles.card}`))
    cards.forEach(el => el.classList.remove(styles.visible))
    cards.forEach((el, i) => {
      setTimeout(() => { el.classList.add(styles.visible) }, i * 75)
    })
  }, [loading, filtered.length, filter, search])

  const load = async () => {
    const data = await getCommunities()
    // Enrich with counts
    const enriched = await Promise.all(data.map(async c => {
      const [{ count: mc }, { count: pc }] = await Promise.all([
        supabase.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', c.id),
        supabase.from('community_posts').select('*', { count: 'exact', head: true }).eq('community_id', c.id).eq('status', 'approved'),
      ])
      return { ...c, member_count: mc || 0, post_count: pc || 0 }
    }))
    setCommunities(enriched)
    setLoading(false)
  }

  const createCommunity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { navigate('/'); return }
    setCreating(true)
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36)
    const { error } = await supabase.from('communities').insert({
      ...form, slug, created_by: user.id
    })
    if (error) { showToast(error.message, 'error'); setCreating(false); return }
    showToast('Community created! ✦')
    setShowCreate(false)
    setForm({ name: '', description: '', emoji: '🏛️', category: 'General' })
    load()
    setCreating(false)
  }

  return (
    <>
    <PublicNav />
    <div className={styles.page} style={{ margin: '0 auto' }}>
      <VerseOfDay />

      <div className={styles.header}>
        <div>
          <h1>Communities</h1>
          <p>Find your people. Grow together.</p>
        </div>
        {user && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            ✦ New Community
          </button>
        )}
      </div>

      {/* Filters */}
      <div className={styles.controls}>
        <div className={styles.categories}>
          {CATEGORIES.map(cat => (
            <button key={cat} className={`${styles.catBtn} ${filter === cat ? styles.active : ''}`} onClick={() => setFilter(cat)}>
              {cat}
            </button>
          ))}
        </div>
        <input className={styles.search} placeholder="Search communities..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Grid */}
      {loading ? (
        <div className={styles.grid}>
          {[1,2,3,4,5,6].map(i => <div key={i} className={`skeleton ${styles.skeletonCard}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <span>🏛️</span>
          <h3>No communities yet</h3>
          <p>{user ? 'Be the first to create one.' : 'Sign in to create a community.'}</p>
          {user && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Community</button>}
        </div>
      ) : (
        <div className={styles.grid} ref={gridRef}>
          {filtered.map((c, i) => (
            <div key={c.id} className={styles.card} onClick={() => navigate(`/c/${c.slug}`)}>
              <div className={styles.cardTop}>
                <span className={styles.emoji}>{c.emoji}</span>
                <span className={styles.category}>{c.category}</span>
              </div>
              <h3 className={styles.name}>{c.name}</h3>
              <p className={styles.desc}>{c.description || 'A space for writers to share.'}</p>
              <div className={styles.stats}>
                <span>👥 {c.member_count}</span>
                <span>📄 {c.post_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create a Community</h2>
              <button className={styles.closeBtn} onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={createCommunity} className={styles.form}>
              <div className={styles.emojiRow}>
                {['🏛️','⛪','📖','🕊️','🙏','✝️','🌟','🔥','💫','🌿','☀️','🌊'].map(e => (
                  <button type="button" key={e} className={`${styles.emojiOpt} ${form.emoji === e ? styles.emojiActive : ''}`} onClick={() => setForm(f => ({ ...f, emoji: e }))}>
                    {e}
                  </button>
                ))}
              </div>
              <div className={styles.field}>
                <label>Community Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Morning Devotionals" required maxLength={60} />
              </div>
              <div className={styles.field}>
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this community about?" rows={3} maxLength={300} />
              </div>
              <div className={styles.field}>
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating || !form.name}>
                  {creating ? 'Creating...' : 'Create Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
