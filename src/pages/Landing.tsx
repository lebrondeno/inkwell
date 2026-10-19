import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import styles from './Landing.module.css'

export default function Landing() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { showToast, theme, toggleTheme } = useApp()
  const navigate = useNavigate()

  const openSignUp = () => {
    setMode('signup')
    setResetSent(false)
    setAuthModalOpen(true)
  }

  const openSignIn = () => {
    setMode('signin')
    setResetSent(false)
    setAuthModalOpen(true)
  }

  const closeModal = () => {
    setAuthModalOpen(false)
    setResetSent(false)
  }

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
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } }
        })
        if (error) throw error
        showToast('Account created — welcome to Inkwell')
        closeModal()
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        closeModal()
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
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
      {/* Background artwork and vignette overlay */}
      <div className={styles.bgArtwork} />
      <div className={styles.vignetteOverlay} />

      {/* Header bar */}
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>✦</span>
          <span className={styles.brandTitle}>Inkwell</span>
        </div>
        <div className={styles.topRight}>
          <button
            type="button"
            className={styles.topLink}
            onClick={() => navigate('/discover')}
          >
            Discover Articles
          </button>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            title="Toggle theme"
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      {/* Centered Hero View */}
      <main className={styles.heroCenter}>
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot}>✦</span>
            <span>A SANCTUARY FOR SERIOUS WRITING</span>
          </div>

          <h1 className={styles.headline}>
            Where ideas<br />
            <em>find their voice.</em>
          </h1>

          <p className={styles.subtitle}>
            An executive editorial environment crafted for literary depth and focused thought.
            Distraction-free composition, intelligent assistance, and timeless typography.
          </p>

          <div className={styles.actionButtons}>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={openSignUp}
            >
              Get Started
            </button>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={openSignIn}
            >
              Log In
            </button>
          </div>

          <p className={styles.footnote}>
            Completely free · Distraction-free · No subscription required
          </p>
        </div>
      </main>

      {/* Auth Modal Overlay */}
      {authModalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <span className={styles.modalLogo}>✦</span>
                <h2 className={styles.modalTitle}>
                  {mode === 'signin'
                    ? 'Welcome back'
                    : mode === 'signup'
                    ? 'Begin your journey'
                    : 'Reset password'}
                </h2>
                <p className={styles.modalSubtitle}>
                  {mode === 'signin'
                    ? 'Sign in to access your writing studio'
                    : mode === 'signup'
                    ? 'Create your free Inkwell account'
                    : 'Enter your email to receive recovery instructions'}
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={closeModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {mode === 'forgot' && resetSent ? (
              <div className={styles.successState}>
                <span className={styles.successIcon}>✓</span>
                <h3>Check your email</h3>
                <p>
                  We have dispatched a password recovery link to <strong>{email}</strong>.
                  Follow the instructions in the email to set a new password.
                </p>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={() => switchModeTo('signin')}
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuth} className={styles.authForm}>
                {mode === 'signup' && (
                  <div className={styles.field}>
                    <label htmlFor="auth-name">Full Name</label>
                    <input
                      id="auth-name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                )}

                <div className={styles.field}>
                  <label htmlFor="auth-email">Email Address</label>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus={mode !== 'signup'}
                  />
                </div>

                {mode !== 'forgot' && (
                  <div className={styles.field}>
                    <div className={styles.fieldHeader}>
                      <label htmlFor="auth-password">Password</label>
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
                      id="auth-password"
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
                  className={styles.submitBtn}
                  disabled={loading}
                >
                  {loading
                    ? 'Please wait…'
                    : mode === 'signin'
                    ? 'Enter Studio'
                    : mode === 'signup'
                    ? 'Create Free Account'
                    : 'Send Recovery Link'}
                </button>
              </form>
            )}

            <div className={styles.switchMode}>
              {mode === 'signin' ? (
                <p>
                  No account?{' '}
                  <button type="button" onClick={() => switchModeTo('signup')}>
                    Create one free
                  </button>
                </p>
              ) : mode === 'signup' ? (
                <p>
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchModeTo('signin')}>
                    Sign in
                  </button>
                </p>
              ) : (
                <p>
                  Remember your password?{' '}
                  <button type="button" onClick={() => switchModeTo('signin')}>
                    Return to Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
