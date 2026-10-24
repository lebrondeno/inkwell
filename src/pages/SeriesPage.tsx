import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getUserSeries, createSeries } from '../lib/supabase'
import type { Series } from '../lib/supabase'
import styles from './SeriesPage.module.css'

export default function SeriesPage() {
  const { user, showToast } = useApp()
  const navigate = useNavigate()
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [emoji, setEmoji] = useState('📚')
  const [saving, setSaving] = useState(false)

  const loadSeries = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await getUserSeries(user.id)
      setSeriesList(data)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadSeries()
  }, [loadSeries])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      showToast('Please enter a series title', 'error')
      return
    }
    if (!user?.id) return

    setSaving(true)
    try {
      const created = await createSeries(user.id, title, desc, emoji)
      setSeriesList(prev => [created, ...prev])
      showToast('Series created successfully!')
      setShowModal(false)
      setTitle('')
      setDesc('')
    } catch {
      showToast('Failed to create series', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Series & Collections</h1>
          <p className={styles.sub}>Group articles into multi-part essays, chapters, and thematic publications.</p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowModal(true)}>
          <span>✦</span> New Series
        </button>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading your series...</div>
      ) : seriesList.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📚</div>
          <h3>No Series Created Yet</h3>
          <p>Group your stories into serialized publications, essays, or chapters.</p>
          <button className={styles.createBtn} onClick={() => setShowModal(true)}>
            Create First Series
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {seriesList.map(s => (
            <div key={s.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.emoji}>{s.cover_emoji || '📚'}</span>
                <span className={styles.count}>Series</span>
              </div>
              <h3 className={styles.cardTitle}>{s.title}</h3>
              <p className={styles.cardDesc}>{s.description || 'No description provided.'}</p>
              <div className={styles.cardFoot}>
                <span>Created {new Date(s.created_at).toLocaleDateString()}</span>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => navigate(`/app/write?series=${s.id}`)}
                >
                  + Add Post
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create New Series</h3>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className={styles.formGroup}>
                <label>Series Emoji</label>
                <input
                  type="text"
                  className={styles.input}
                  value={emoji}
                  onChange={e => setEmoji(e.target.value)}
                  style={{ width: '80px', textAlign: 'center', fontSize: '18px' }}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Title</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Chronicles of Grace, Architecture in Practice..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label>Description (Optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="A short overview of what this collection covers..."
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Series'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
