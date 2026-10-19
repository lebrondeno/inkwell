import { useState, useEffect } from 'react'
import { fetchBibleVerse } from '../lib/supabase'
import type { BibleVerse } from '../lib/supabase'
import styles from './BibleVerseBlock.module.css'

interface Props {
  reference: string
  compact?: boolean
}

export default function BibleVerseBlock({ reference, compact = false }: Props) {
  const [prevReference, setPrevReference] = useState(reference)
  const [verse, setVerse] = useState<BibleVerse | null>(null)
  const [loading, setLoading] = useState(() => Boolean(reference?.trim()))
  const [error, setError] = useState(false)

  if (reference !== prevReference) {
    setPrevReference(reference)
    setLoading(Boolean(reference?.trim()))
    setError(false)
    setVerse(null)
  }

  useEffect(() => {
    const trimmed = reference?.trim()
    if (!trimmed) return

    let cancelled = false
    fetchBibleVerse(trimmed).then(data => {
      if (cancelled) return
      if (data) {
        setVerse(data)
        setError(false)
      } else {
        setError(true)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [reference])

  if (!reference?.trim()) return null

  if (loading) return (
    <div className={`${styles.block} ${compact ? styles.compact : ''}`}>
      <div className={styles.loading}>
        <span className={styles.pulse}>✦</span>
        <span>Loading verse...</span>
      </div>
    </div>
  )

  if (error) return (
    <div className={`${styles.block} ${compact ? styles.compact : ''} ${styles.errorBlock}`}>
      <span className={styles.crossIcon}>✝</span>
      <span className={styles.errorText}>Could not load "{reference}" — check the reference format</span>
    </div>
  )

  if (!verse) return null

  return (
    <div className={`${styles.block} ${compact ? styles.compact : ''}`}>
      <div className={styles.inner}>
        <span className={styles.crossIcon}>✝</span>
        <div className={styles.content}>
          <p className={styles.text}>"{verse.text?.trim()}"</p>
          <div className={styles.meta}>
            <span className={styles.reference}>{verse.reference}</span>
            <span className={styles.dot}>·</span>
            <span className={styles.translation}>{verse.translation_name || 'NIV'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
