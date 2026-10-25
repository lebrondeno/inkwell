import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, getNotifications, getWritingStreak, openGlobalSearch } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import NotificationDrawer from './NotificationDrawer'
import styles from './Sidebar.module.css'

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
  onOpenNotifications?: () => void
  unreadCount?: number
  streakDays?: number
}

const NAV_MAIN = [
  { icon: '◈', label: 'Dashboard',    path: '/app' },
  { icon: '✦', label: 'My Articles',  path: '/app/articles' },
  { icon: '◉', label: 'Write',        path: '/app/write', badge: 'New' },
  { icon: '📚', label: 'Series',       path: '/app/series' },
  { icon: '🔖', label: 'Reading List', path: '/app/bookmarks' },
  { icon: '⊡', label: 'Analytics',    path: '/app/analytics' },
  { icon: '🏛️', label: 'Communities',  path: '/app/communities' },
  { icon: '◎', label: 'Profile',      path: '/app/profile' },
]

const NAV_EXTRA = [
  { icon: '⟡', label: 'Discover',    path: '/discover' },
]

export default function Sidebar({
  mobileOpen = false,
  onClose,
  onOpenNotifications,
  unreadCount: propUnreadCount,
  streakDays: propStreakDays,
}: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, showToast, theme, toggleTheme } = useApp()
  const [signingOut, setSigningOut] = useState(false)
  const [internalNotifOpen, setInternalNotifOpen] = useState(false)
  const [localUnreadCount, setLocalUnreadCount] = useState(0)
  const [localStreakDays, setLocalStreakDays] = useState(0)

  // Use props if supplied, otherwise use local state
  const unreadCount = propUnreadCount !== undefined ? propUnreadCount : localUnreadCount
  const streakDays = propStreakDays !== undefined ? propStreakDays : localStreakDays

  // Auto-close drawer on location change
  useEffect(() => {
    onClose?.()
  }, [location.pathname, onClose])

  // Fallback poll if props not provided
  useEffect(() => {
    if (propUnreadCount !== undefined && propStreakDays !== undefined) return
    let mounted = true
    const fetchStatus = async () => {
      if (!user?.id) return
      try {
        const [notifs, streak] = await Promise.all([
          getNotifications(user.id),
          getWritingStreak(user.id)
        ])
        if (mounted) {
          setLocalUnreadCount(notifs.filter(n => !n.is_read).length)
          setLocalStreakDays(streak.currentStreak)
        }
      } catch {
        /* ignore error during periodic poll */
      }
    }

    void fetchStatus()
    const timer = setInterval(() => { void fetchStatus() }, 60000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [user?.id, propUnreadCount, propStreakDays])

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    onClose?.()
    showToast('Signed out successfully')
  }

  const handleNavClick = (path: string) => {
    navigate(path)
    onClose?.()
  }

  const handleNotifClick = () => {
    if (onOpenNotifications) {
      onOpenNotifications()
    } else {
      setInternalNotifOpen(true)
    }
  }

  const handleSearchClick = () => {
    onClose?.()
    openGlobalSearch()
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Writer'
  const initials    = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const isActive    = (path: string) => path === '/app' ? location.pathname === '/app' : location.pathname.startsWith(path)

  return (
    <>
      {/* Dark backdrop overlay on mobile */}
      <div
        className={`${styles.backdrop} ${mobileOpen ? styles.backdropOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        {/* Brand Header */}
        <div className={styles.logo}>
          <div
            className={styles.logoBrand}
            onClick={() => handleNavClick('/app')}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') handleNavClick('/app') }}
            title="Inkwell Dashboard"
          >
            <img src="/favicon.svg?v=10" alt="Inkwell" className={styles.brandMark} />
            <span className={styles.name}>Inkwell</span>
          </div>
          <button
            className={styles.mobileCloseBtn}
            onClick={onClose}
            aria-label="Close menu"
            title="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Top Utility Row (Desktop only): Streak Badge + Notifications + Theme */}
        <div className={styles.utilityRow}>
          <div className={styles.streakBadge} title={`Current Writing Streak: ${streakDays} day${streakDays === 1 ? '' : 's'}`}>
            <span>🔥</span>
            <span>{streakDays}d streak</span>
          </div>

          <div className={styles.utilityActions}>
            <button
              className={styles.notifBtn}
              onClick={handleNotifClick}
              title="Notifications"
              aria-label="View notifications"
            >
              <span>🔔</span>
              {unreadCount > 0 && (
                <span className={styles.notifBadge}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              className={styles.themeBtn}
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </div>
        </div>

        {/* Prominent Global Search Trigger Button */}
        <div className={styles.searchWrap}>
          <button
            type="button"
            className={styles.searchTriggerBtn}
            onClick={handleSearchClick}
            title="Search writers, articles, series, and communities (Ctrl+K)"
            aria-label="Search writers, articles, series, and communities"
          >
            <span className={styles.searchIcon}>🔍</span>
            <span className={styles.searchPlaceholder}>Search writers, articles…</span>
            <kbd className={styles.searchShortcut}>Ctrl K</kbd>
          </button>
        </div>

        {/* Navigation items */}
        <nav className={styles.nav}>
          <p className={styles.navLabel}>Navigation</p>
          {NAV_MAIN.map(item => (
            <button
              key={item.path}
              className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
              onClick={() => handleNavClick(item.path)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <span className={styles.newBadge}>{item.badge}</span>}
            </button>
          ))}

          <div className={styles.navDivider} />
          <p className={styles.navLabel}>Explore</p>
          {NAV_EXTRA.map(item => (
            <button
              key={item.path}
              className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
              onClick={() => handleNavClick(item.path)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User profile / Logout bottom card */}
        <div className={styles.bottom}>
          <div className={styles.userCard}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userInfo}>
              <p className={styles.userName}>{displayName}</p>
              <p className={styles.userEmail}>{user?.email}</p>
            </div>
          </div>
          <button className={styles.signOut} onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? '…' : '→ Sign out'}
          </button>
        </div>
      </aside>

      {/* Fallback Notifications Drawer if not provided via props */}
      {!onOpenNotifications && (
        <NotificationDrawer
          open={internalNotifOpen}
          onClose={() => setInternalNotifOpen(false)}
          userId={user?.id || ''}
          onUnreadChange={count => setLocalUnreadCount(count)}
        />
      )}
    </>
  )
}
