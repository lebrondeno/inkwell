import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import styles from './MobileNav.module.css'

const NAV_ITEMS = [
  { icon: '◈', label: 'Home', path: '/app' },
  { icon: '✦', label: 'Articles', path: '/app/articles' },
  { icon: '◉', label: 'Write', path: '/app/write' },
  { icon: '⊡', label: 'Analytics', path: '/app/analytics' },
  { icon: '◎', label: 'Profile', path: '/app/profile' },
]

export default function MobileNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useApp()

  return (
    <>
      {/* Mobile Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.logo}>Inkwell</div>
        <button 
          className={styles.themeToggle}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.bottomNav}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`${styles.navItem} ${location.pathname === item.path ? styles.active : ''}`}
            onClick={() => navigate(item.path)}
            title={item.label}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
