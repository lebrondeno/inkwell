import styles from './PublishModal.module.css'

interface PublishModalProps {
  articleSlug: string
  articleTitle: string
  onClose: () => void
}

export default function PublishModal({ articleSlug, articleTitle, onClose }: PublishModalProps) {
  const shareLink = `${window.location.origin}/articles/${articleSlug}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>✓ Article Published!</h2>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.content}>
          <p className={styles.subtitle}>Your article is now live and ready to share!</p>
          
          <div className={styles.titleBox}>
            <p className={styles.articleTitle}>{articleTitle}</p>
          </div>

          <div className={styles.linkBox}>
            <label>Share this link:</label>
            <div className={styles.linkContainer}>
              <input 
                type="text" 
                readOnly 
                value={shareLink}
                className={styles.linkInput}
              />
              <button className={styles.copyBtn} onClick={copyToClipboard}>
                📋 Copy
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            <a href={shareLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              View Article →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
