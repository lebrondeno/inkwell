import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import styles from './Landing.module.css'

export default function Landing() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const { showToast, theme, toggleTheme } = useApp()
  const navigate = useNavigate()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        })
        if (error) throw error
        showToast('Account created — welcome to Inkwell')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: any) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.landingRoot}>
      {/* Top strip nav */}
      <div className={styles.topStrip}>
        <span className={styles.stripLogo}>✦ Inkwell</span>
        <div className={styles.stripRight}>
          <button className={styles.stripLink} onClick={() => navigate('/discover')}>
            Discover Articles
          </button>
          <button className={styles.themeToggle} onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </div>

      <div className={styles.landing}>
        {/* Background ornaments */}
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.grid} />

        {/* Left — Brand */}
        <div className={styles.left}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>✦</span>
            <span className={styles.logoText}>Inkwell</span>
          </div>

          <div className={styles.hero}>
            <p className={styles.eyebrow}>Your private studio for serious writing</p>
            <h1 className={styles.headline}>
              Where ideas<br />
              <em>find their voice.</em>
            </h1>
            <p className={styles.sub}>
              An editorial writing environment built for depth — with AI assistance,
              distraction-free focus, and the feel of a premium platform. For free.
            </p>
          </div>

          <div className={styles.features}>
            {[
              { icon: '✦', label: 'AI-powered writing assistant' },
              { icon: '◈', label: 'Distraction-free editor' },
              { icon: '◉', label: 'Publish & share beautifully' },
              { icon: '⊡', label: 'Writing streaks & analytics' },
            ].map(f => (
              <div key={f.label} className={styles.feature}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.quote}>
            <p>"The scariest moment is always just before you start."</p>
            <span>— Stephen King</span>
          </div>
        </div>

        {/* Right — Auth */}
        <div className={styles.right}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h2>{mode === 'signin' ? 'Welcome back' : 'Begin your journey'}</h2>
              <p>{mode === 'signin' ? 'Sign in to your writing studio' : 'Create your free account'}</p>
            </div>

            <form onSubmit={handleAuth} className={styles.form}>
              {mode === 'signup' && (
                <div className={styles.field}>
                  <label>Full name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className={styles.field}>
                <label>Email address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
                disabled={loading}
              >
                {loading ? 'Please wait…' : mode === 'signin' ? 'Enter Studio' : 'Create Account'}
              </button>
            </form>

            <div className={styles.switchMode}>
              {mode === 'signin' ? (
                <p>No account? <button onClick={() => setMode('signup')}>Create one free</button></p>
              ) : (
                <p>Already have one? <button onClick={() => setMode('signin')}>Sign in</button></p>
              )}
            </div>

            <div className={styles.dividerOr}><span>or</span></div>

            <button className={`btn btn-ghost ${styles.discoverBtn}`} onClick={() => navigate('/discover')}>
              ✦ Browse Articles Without Signing In
            </button>

            <div className={styles.disclaimer}>
              No credit card. No subscription. Completely free.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
