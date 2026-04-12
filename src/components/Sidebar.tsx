import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import styles from './Sidebar.module.css'

const NAV = [
  { icon: '◈', label: 'Dashboard',  path: '/app' },
  { icon: '✦', label: 'My Articles',path: '/app/articles' },
  { icon: '◉', label: 'Write',      path: '/app/write', badge: 'New' },
  { icon: '⊡', label: 'Analytics',  path: '/app/analytics' },
  { icon: '◎', label: 'Profile',    path: '/app/profile' },
]

const NAV_BOTTOM = [
  { icon: '⟡', label: 'Discover',   path: '/discover' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, showToast, theme, toggleTheme } = useApp()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    showToast('Signed out successfully')
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Writer'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const isActive = (path: string) =>
    path === '/app' ? location.pathname === '/app' : location.pathname.startsWith(path)

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.mark}>✦</span>
        <span className={styles.name}>Inkwell</span>
        {/* Theme toggle right in logo bar */}
        <button
          className={styles.themeBtn}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      {/* Main Nav */}
      <nav className={styles.nav}>
        <p className={styles.navLabel}>Navigation</p>
        {NAV.map(item => (
          <button
            key={item.path}
            className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && <span className={styles.newBadge}>{item.badge}</span>}
          </button>
        ))}

        <div className={styles.navDivider} />
        <p className={styles.navLabel}>Explore</p>
        {NAV_BOTTOM.map(item => (
          <button
            key={item.path}
            className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom user card */}
      <div className={styles.bottom}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{displayName}</p>
            <p className={styles.userEmail}>{user?.email}</p>
          </div>
        </div>
        <button
          className={styles.signOut}
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? '…' : '→ Sign out'}
        </button>
      </div>
    </aside>
  )
}
