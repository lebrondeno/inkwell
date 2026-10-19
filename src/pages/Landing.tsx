import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import styles from './Landing.module.css'

export default function Landing() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [resetSent, setResetSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { showToast, theme, toggleTheme } = useApp()
  const navigate = useNavigate()

  const switchModeTo = (newMode: 'signin' | 'signup' | 'forgot') => {
    setMode(newMode)
    setResetSent(false)
  }

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
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + '/reset-password',
        })
        if (error) throw error
        setResetSent(true)
        showToast('Password reset link sent! Please check your email for instructions.', 'success')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      showToast(message, 'error')
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
              <h2>
                {mode === 'signin'
                  ? 'Welcome back'
                  : mode === 'signup'
                  ? 'Begin your journey'
                  : 'Reset password'}
              </h2>
              <p>
                {mode === 'signin'
                  ? 'Sign in to your writing studio'
                  : mode === 'signup'
                  ? 'Create your free account'
                  : 'Enter your email to receive recovery instructions'}
              </p>
            </div>

            {mode === 'forgot' && resetSent ? (
              <div className={styles.successBox}>
                <span className={styles.successIcon}>✓</span>
                <h3>Check your email</h3>
                <p>
                  We've sent a password reset link to <strong>{email}</strong>.
                  Please check your inbox (and spam folder) and follow the link to reset your password.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '13px', marginTop: '16px' }}
                  onClick={() => switchModeTo('signin')}
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
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
                {mode !== 'forgot' && (
                  <div className={styles.field}>
                    <div className={styles.fieldHeader}>
                      <label>Password</label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          className={styles.forgotBtn}
                          onClick={() => switchModeTo('forgot')}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
                  disabled={loading}
                >
                  {loading
                    ? 'Please wait…'
                    : mode === 'signin'
                    ? 'Enter Studio'
                    : mode === 'signup'
                    ? 'Create Account'
                    : 'Send Recovery Link'}
                </button>
              </form>
            )}

            <div className={styles.switchMode}>
              {mode === 'signin' ? (
                <p>No account? <button type="button" onClick={() => switchModeTo('signup')}>Create one free</button></p>
              ) : mode === 'signup' ? (
                <p>Already have one? <button type="button" onClick={() => switchModeTo('signin')}>Sign in</button></p>
              ) : (
                <p>Remember your password? <button type="button" onClick={() => switchModeTo('signin')}>Return to Sign In</button></p>
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
