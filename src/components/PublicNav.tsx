import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import styles from './PublicNav.module.css'

export default function PublicNav() {
  const { user, theme, toggleTheme } = useApp()
  const navigate = useNavigate()

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to={user ? '/app' : '/'} className={styles.logo}>
          <span className={styles.mark}>✦</span>
          <span>Inkwell</span>
        </Link>

        <div className={styles.links}>
          <Link to="/discover" className={styles.link}>Discover</Link>
          <Link to="/communities" className={styles.link}>Communities</Link>
        </div>

        <div className={styles.actions}>
          <button className={styles.themeBtn} onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {user ? (
            <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: '12px' }}
              onClick={() => navigate('/app')}>
              Dashboard →
            </button>
          ) : (
            <Link to="/" className="btn btn-primary" style={{ padding: '7px 16px', fontSize: '12px' }}>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
