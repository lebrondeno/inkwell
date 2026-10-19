import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import styles from './ResetPassword.module.css'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { user, session, loading: authLoading, showToast, theme, toggleTheme, isPasswordRecovery, clearPasswordRecovery } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    // Check if Supabase passed error params in hash or query
    const hash = window.location.hash.substring(1)
    const hashParams = new URLSearchParams(hash)
    const searchParams = new URLSearchParams(window.location.search)

    const errorDesc = hashParams.get('error_description') || searchParams.get('error_description')
    if (errorDesc) {
      setErrorMsg(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      clearPasswordRecovery()
      showToast('Password updated successfully!')
      navigate('/app', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update password'
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    clearPasswordRecovery()
    navigate(user ? '/app' : '/')
  }

  // Check if there is an active session or recovery token in URL/storage
  const hasTokenInUrl =
    window.location.hash.includes('access_token') ||
    window.location.search.includes('code') ||
    window.location.hash.includes('type=recovery') ||
    window.location.search.includes('type=recovery')

  const canReset = Boolean(user || session || hasTokenInUrl || isPasswordRecovery)

  return (
    <div className={styles.resetRoot}>
      {/* Top strip */}
      <header className={styles.topStrip}>
        <button className={styles.stripLogo} onClick={handleCancel}>
          ✦ Inkwell
        </button>
        <div className={styles.stripRight}>
          <button className={styles.stripLink} onClick={() => navigate('/discover')}>
            Discover Articles
          </button>
          <button className={styles.themeToggle} onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      <main className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.logoMark}>✦</span>
            <h1 className={styles.title}>Set New Password</h1>
            <p className={styles.subtitle}>
              Choose a secure password for your Inkwell account.
            </p>
          </div>

          {errorMsg ? (
            <div>
              <div className={styles.errorBox}>{errorMsg}</div>
              <button
                type="button"
                className={`btn btn-primary ${styles.submitBtn}`}
                onClick={handleCancel}
              >
                Return to Sign In
              </button>
            </div>
          ) : authLoading ? (
            <div className={styles.loadingSpinner}>
              <span>✦</span>
            </div>
          ) : !canReset ? (
            <div>
              <div className={styles.infoBox}>
                No active password recovery session was found. If your link has expired or has already been used, please request a new one.
              </div>
              <button
                type="button"
                className={`btn btn-primary ${styles.submitBtn}`}
                onClick={handleCancel}
              >
                Return to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
                <span className={styles.fieldHint}>Must be at least 6 characters</span>
              </div>

              <div className={styles.field}>
                <label htmlFor="confirm-password">Confirm New Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className={styles.buttonGroup}>
                <button
                  type="submit"
                  className={`btn btn-primary ${styles.submitBtn}`}
                  disabled={loading}
                >
                  {loading ? 'Saving password…' : 'Save Password'}
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost ${styles.cancelBtn}`}
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
