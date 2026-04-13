import { useState } from 'react'
import styles from './PublishModal.module.css'

interface PublishModalProps {
  articleSlug: string
  articleTitle: string
  onClose: () => void
}

export default function PublishModal({ articleSlug, articleTitle, onClose }: PublishModalProps) {
  const shareLink = `${window.location.origin}/articles/${articleSlug}`
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Success header */}
        <div className={styles.successHeader}>
          <div className={styles.checkmark}>✓</div>
          <h2 className={styles.successTitle}>Published!</h2>
          <p className={styles.successSub}>Your article is live — anyone can read it now.</p>
        </div>

        <div className={styles.body}>
          {/* Article title */}
          <div className={styles.articlePreview}>
            <span className={styles.previewEmoji}>✦</span>
            <span className={styles.previewTitle}>{articleTitle}</span>
          </div>

          {/* Share link */}
          <div className={styles.linkSection}>
            <p className={styles.linkLabel}>🔗 Shareable link</p>
            <div className={styles.linkRow}>
              <input
                type="text"
                readOnly
                value={shareLink}
                className={styles.linkInput}
                onFocus={e => { e.target.select(); copyLink() }}
              />
              <button
                className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
                onClick={copyLink}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button className="btn btn-ghost" onClick={onClose}>Done</button>
            <a
              href={shareLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              View Article →
            </a>
          </div>
        </div>

        <button className={styles.closeX} onClick={onClose} aria-label="Close">✕</button>
      </div>
    </div>
  )
}
