import { useState, useEffect } from 'react'
import { fetchVerseOfDay } from '../lib/supabase'
import type { BibleVerse } from '../lib/supabase'
import styles from './VerseOfDay.module.css'

interface VerseOfDayProps {
  communityId?: string
}

export default function VerseOfDay({ communityId }: VerseOfDayProps) {
  const [verse, setVerse] = useState<BibleVerse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVerseOfDay(communityId).then(v => {
      setVerse(v)
      setLoading(false)
    })
  }, [communityId])

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
        <span className={styles.translation}>{verse.translation_name}</span>
      </div>
      <p className={styles.text}>"{verse.text?.trim()}"</p>
      <p className={styles.reference}>{verse.reference}</p>
    </div>
  )
}
