import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import styles from './Sidebar.module.css'

const NAV = [
  { icon: '◈', label: 'Dashboard', path: '/app' },
  { icon: '✦', label: 'My Articles', path: '/app/articles' },
  { icon: '◉', label: 'Write', path: '/app/write' },
  { icon: '⊡', label: 'Analytics', path: '/app/analytics' },
  { icon: '◎', label: 'Profile', path: '/app/profile' },
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

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.mark}>✦</span>
        <span className={styles.name}>Inkwell</span>
      </div>

      <nav className={styles.nav}>
        <p className={styles.navLabel}>Navigation</p>
        {NAV.map(item => (
          <button
            key={item.path}
            className={`${styles.navItem} ${location.pathname === item.path ? styles.active : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
            {item.path === '/app/write' && (
              <span className={styles.newBadge}>New</span>
            )}
          </button>
        ))}
      </nav>

      <div className={styles.themeToggle}>
        <button 
          className={styles.themeBtn}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

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
          {signingOut ? '...' : '→ Sign out'}
        </button>
      </div>
    </aside>
  )
}
