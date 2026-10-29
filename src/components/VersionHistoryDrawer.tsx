import { useEffect, useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { getArticleVersions } from '../lib/supabase'
import type { ArticleVersion } from '../lib/supabase'
import styles from './VersionHistoryDrawer.module.css'

interface Props {
  open: boolean
  onClose: () => void
  articleId: string
  onRestore: (version: ArticleVersion) => void
}

export default function VersionHistoryDrawer({ open, onClose, articleId, onRestore }: Props) {
  const [versions, setVersions] = useState<ArticleVersion[]>([])
  const [loading, setLoading] = useState(false)

  const loadVersions = useCallback(async () => {
    if (!articleId) return
    setLoading(true)
    try {
      const list = await getArticleVersions(articleId)
      setVersions(list)
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    if (open && articleId) {
      loadVersions()
    }
  }, [open, articleId, loadVersions])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()} role="dialog" aria-label="Version history">
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Version History</h3>
            <span className={styles.count}>{versions.length} Checkpoints</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close history">
            ✕ Close
          </button>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>Loading version history...</div>
          ) : versions.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⏳</div>
              <p>No snapshots recorded yet.</p>
              <span style={{ fontSize: '12px' }}>
                Snapshots are automatically created before AI changes, on save checkpoints, and on publish.
              </span>
            </div>
          ) : (
            versions.map(v => {
              const isAi = v.reason.toLowerCase().includes('ai')
              const plain = (v.content || '').replace(/<[^>]*>/g, '').trim()
              return (
                <div key={v.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <span className={`${styles.reasonBadge} ${isAi ? styles.reasonAi : ''}`}>
                      {v.reason}
                    </span>
                    <span className={styles.timestamp}>
                      {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  <h4 className={styles.cardTitle}>{v.title || 'Untitled'}</h4>
                  <p className={styles.preview}>{plain.slice(0, 100) || 'Empty content snapshot'}</p>

                  <div className={styles.cardFoot}>
                    <span className={styles.wordCount}>{v.word_count} words</span>
                    <button
                      className={styles.restoreBtn}
                      onClick={() => {
                        onRestore(v)
                        onClose()
                      }}
                    >
                      ↺ Restore
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
