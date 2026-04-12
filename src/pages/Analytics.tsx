import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import type { Article } from '../lib/supabase'
import styles from './Analytics.module.css'

export default function Analytics() {
  const { user } = useApp()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('articles')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setArticles(data || [])
        setLoading(false)
      })
  }, [])

  const totalWords = articles.reduce((s, a) => s + (a.word_count || 0), 0)
  const published = articles.filter(a => a.status === 'published')
  const avgWords = articles.length ? Math.round(totalWords / articles.length) : 0
  const totalReadingTime = articles.reduce((s, a) => s + (a.reading_time || 0), 0)

  // Activity heatmap data — last 30 days
  const last30 = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
  const activityMap: Record<string, number> = {}
  articles.forEach(a => {
    const day = format(new Date(a.created_at), 'yyyy-MM-dd')
    activityMap[day] = (activityMap[day] || 0) + 1
  })

  // Top tags
  const tagCount: Record<string, number> = {}
  articles.forEach(a => a.tags?.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1 }))
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxTag = topTags[0]?.[1] || 1

  // Words per article for chart
  const chartArticles = articles.slice(-10)
  const maxBarWords = Math.max(...chartArticles.map(a => a.word_count || 0), 1)

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}><h1>Analytics</h1></div>
        <div className={styles.skeletonGrid}>
          {[1,2,3,4].map(i => <div key={i} className={`skeleton ${styles.skeletonCard}`} />)}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Analytics</h1>
          <p>Your writing journey in numbers</p>
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.statsGrid}>
        {[
          { label: 'Total Articles', value: articles.length, icon: '◈', suffix: '' },
          { label: 'Words Written', value: totalWords.toLocaleString(), icon: '✦', suffix: '' },
          { label: 'Published', value: published.length, icon: '◉', suffix: '' },
          { label: 'Avg. Words', value: avgWords.toLocaleString(), icon: '⊡', suffix: '/article' },
          { label: 'Reading Time', value: totalReadingTime, icon: '◎', suffix: ' min' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statIcon}>{s.icon}</span>
            <span className={styles.statValue}>{s.value}{s.suffix}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.charts}>
        {/* Activity heatmap */}
        <div className={styles.chartCard}>
          <h3>Writing Activity <span>last 30 days</span></h3>
          <div className={styles.heatmap}>
            {last30.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const count = activityMap[key] || 0
              return (
                <div
                  key={key}
                  className={styles.heatCell}
                  title={`${format(day, 'MMM d')}: ${count} article${count !== 1 ? 's' : ''}`}
                  style={{
                    background: count === 0
                      ? 'var(--bg-hover)'
                      : count === 1
                        ? 'rgba(201,169,110,0.35)'
                        : 'rgba(201,169,110,0.75)',
                    border: count > 0 ? '1px solid rgba(201,169,110,0.3)' : '1px solid var(--border)'
                  }}
                />
              )
            })}
          </div>
          <div className={styles.heatLegend}>
            <span>Less</span>
            {[0, 0.3, 0.6, 1].map(o => (
              <div key={o} style={{
                width: 12, height: 12, borderRadius: 2,
                background: o === 0 ? 'var(--bg-hover)' : `rgba(201,169,110,${o})`,
                border: '1px solid var(--border)'
              }} />
            ))}
            <span>More</span>
          </div>
        </div>

        {/* Word count bar chart */}
        <div className={styles.chartCard}>
          <h3>Words per Article <span>recent 10</span></h3>
          {chartArticles.length === 0 ? (
            <div className={styles.noData}>No data yet</div>
          ) : (
            <div className={styles.barChart}>
              {chartArticles.map(a => (
                <div key={a.id} className={styles.barItem}>
                  <div className={styles.barLabelRow}>
                    <span className={styles.barLabel}>{a.title?.slice(0, 20) || 'Untitled'}</span>
                    <span className={styles.barValue}>{(a.word_count || 0).toLocaleString()}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${((a.word_count || 0) / maxBarWords) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className={styles.chartCard}>
          <h3>Status Breakdown</h3>
          <div className={styles.donutWrapper}>
            {['draft', 'published', 'archived'].map(s => {
              const count = articles.filter(a => a.status === s).length
              const pct = articles.length ? Math.round((count / articles.length) * 100) : 0
              const colors: Record<string, string> = {
                draft: 'var(--text-muted)',
                published: 'var(--green)',
                archived: 'var(--red)',
              }
              return (
                <div key={s} className={styles.statusRow}>
                  <div className={styles.statusInfo}>
                    <span className={styles.statusDot} style={{ color: colors[s] }}>●</span>
                    <span className={styles.statusName}>{s}</span>
                  </div>
                  <div className={styles.statusBar}>
                    <div className={styles.statusTrack}>
                      <div
                        className={styles.statusFill}
                        style={{ width: `${pct}%`, background: colors[s] }}
                      />
                    </div>
                    <span className={styles.statusCount}>{count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top tags */}
        <div className={styles.chartCard}>
          <h3>Top Tags</h3>
          {topTags.length === 0 ? (
            <div className={styles.noData}>Add tags to your articles to see them here</div>
          ) : (
            <div className={styles.tagCloud}>
              {topTags.map(([tag, count]) => (
                <div key={tag} className={styles.tagRow}>
                  <span className={styles.tagName}>#{tag}</span>
                  <div className={styles.tagTrack}>
                    <div
                      className={styles.tagFill}
                      style={{ width: `${(count / maxTag) * 100}%` }}
                    />
                  </div>
                  <span className={styles.tagCount}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
