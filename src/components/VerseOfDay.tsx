import { useState, useEffect } from 'react'
import { fetchVerseOfDay } from '../lib/supabase'
import type { BibleVerse } from '../lib/supabase'
import styles from './VerseOfDay.module.css'

export default function VerseOfDay() {
  const [verse, setVerse] = useState<BibleVerse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVerseOfDay().then(v => {
      setVerse(v)
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon}>✝</span>
        <span className={styles.label}>Verse of the Day</span>
      </div>
      <div className={styles.skeleton} />
      <div className={styles.skeletonSm} />
    </div>
  )

  if (!verse) return null

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon}>✝</span>
        <span className={styles.label}>Verse of the Day</span>
        <span className={styles.translation}>NIV</span>
      </div>
      <p className={styles.text}>"{verse.text?.trim()}"</p>
      <p className={styles.reference}>{verse.reference}</p>
    </div>
  )
}
