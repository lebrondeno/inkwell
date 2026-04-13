import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import styles from './MobileNav.module.css'

const NAV_ITEMS = [
  { icon: '◈', label: 'Home',     path: '/app' },
  { icon: '✦', label: 'Articles', path: '/app/articles' },
  { icon: '◉', label: 'Write',    path: '/app/write' },
  { icon: '⊡', label: 'Stats',    path: '/app/analytics' },
  { icon: '◎', label: 'Profile',  path: '/app/profile' },
]

export default function MobileNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { theme, toggleTheme } = useApp()

  return (
    <>
      {/* ── Top Bar ── */}
      <div className={styles.topBar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>✦</span>
          <span>Inkwell</span>
        </div>
        <div className={styles.topActions}>
          <button
            className={styles.discoverLink}
            onClick={() => navigate('/discover')}
            title="Discover articles"
          >
            ⟡ Discover
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
      </div>

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
