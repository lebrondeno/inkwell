import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { openGlobalSearch } from '../lib/supabase'
import styles from './MobileNav.module.css'

interface MobileNavProps {
  onOpenNotifications?: () => void
  unreadCount?: number
  streakDays?: number
}

const NAV_ITEMS = [
  { icon: '◈', label: 'Home',     path: '/app' },
  { icon: '✦', label: 'Articles', path: '/app/articles' },
  { icon: '◉', label: 'Write',    path: '/app/write' },
  { icon: '📚', label: 'Series',   path: '/app/series' },
  { icon: '🏛️', label: 'Groups',   path: '/app/communities' },
  { icon: '◎', label: 'Profile',  path: '/app/profile' },
]

export default function MobileNav({
  onOpenNotifications,
  unreadCount = 0,
  streakDays = 0,
}: MobileNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useApp()

  return (
    <>
      {/* ── Top Bar ── */}
      <header className={styles.topBar}>
        <div className={`${styles.topBarLeft} ${styles.leftGroup}`}>
          <div
            className={styles.brand}
            onClick={() => navigate('/app')}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') navigate('/app') }}
            title="Inkwell Dashboard"
          >
            <img src="/favicon.svg?v=10" alt="Inkwell" className={styles.brandMark} />
            <span className={styles.brandName}>Inkwell</span>
          </div>
        </div>

        <div className={`${styles.topBarRight} ${styles.rightGroup}`}>
          <button
            type="button"
            className={styles.searchBtn}
            onClick={() => openGlobalSearch()}
            aria-label="Search Inkwell"
            title="Search writers, articles, series, and communities"
          >
            🔍
          </button>

          <div
            className={styles.streakPill}
            title={`Writing Streak: ${streakDays} day${streakDays === 1 ? '' : 's'}`}
          >
            <span className={styles.streakFlame}>🔥</span>
            <span>{streakDays}d</span>
          </div>

          <button
            className={styles.notifBtn}
            onClick={onOpenNotifications}
            aria-label="View notifications"
            title="Notifications"
          >
            <span className={styles.notifIcon}>🔔</span>
            {unreadCount > 0 && (
              <span className={styles.notifBadge}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      {/* ── Bottom Nav ── */}
      <nav className={styles.bottomNav} role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map(item => {
          const isActive = item.path === '/app'
            ? location.pathname === '/app'
            : location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
              {isActive && <span className={styles.activeDot} />}
            </button>
          )
        })}
      </nav>
    </>
  )
}
