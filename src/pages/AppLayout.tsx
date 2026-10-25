import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getNotifications, getWritingStreak, supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import MobileNav from '../components/MobileNav'
import NotificationDrawer from '../components/NotificationDrawer'
import Footer from '../components/Footer'
import styles from './AppLayout.module.css'

export default function AppLayout() {
  const { user } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [notifOpen, setNotifOpen] = useState(
    () => searchParams.get('notifications') === 'open'
  )
  const [dismissedMismatchKey, setDismissedMismatchKey] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [streakDays, setStreakDays] = useState(0)

  const forEmail = (searchParams.get('for') || '').trim()
  const forUid = (searchParams.get('uid') || '').trim()
  const currentEmail = (user?.email || '').trim()
  const currentUid = (user?.id || '').trim()

  const emailMismatch =
    Boolean(forEmail && currentEmail) &&
    forEmail.toLowerCase() !== currentEmail.toLowerCase()
  const uidMismatch =
    Boolean(forUid && currentUid) && forUid !== currentUid

  const mismatchKey = `${forEmail}|${forUid}|${currentUid}`
  const hasAccountMismatch =
    Boolean(user) &&
    (emailMismatch || uidMismatch) &&
    dismissedMismatchKey !== mismatchKey

  const intendedEmail = forEmail || 'another Inkwell account'

  // Don't auto-open the wrong account's notifications when an account mismatch is detected
  const isDrawerOpen =
    !hasAccountMismatch &&
    (notifOpen || searchParams.get('notifications') === 'open')

  const getCleanRedirectUrl = () => {
    const cleaned = new URLSearchParams(searchParams)
    cleaned.delete('for')
    cleaned.delete('uid')
    const qs = cleaned.toString()
    return `${location.pathname}${qs ? `?${qs}` : ''}`
  }

  const handleSwitchAccount = async () => {
    const targetRedirect = getCleanRedirectUrl()
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore signOut error */
    }
    const loginParams = new URLSearchParams()
    if (forEmail) {
      loginParams.set('email', forEmail)
    }
    loginParams.set('redirect', targetRedirect)
    navigate(`/login?${loginParams.toString()}`, { replace: true })
  }

  const handleDismissMismatch = () => {
    setDismissedMismatchKey(mismatchKey)
    const next = new URLSearchParams(searchParams)
    next.delete('for')
    next.delete('uid')
    setSearchParams(next, { replace: true })
  }

  const handleCloseNotifications = () => {
    setNotifOpen(false)
    if (searchParams.get('notifications') === 'open') {
      const next = new URLSearchParams(searchParams)
      next.delete('notifications')
      setSearchParams(next, { replace: true })
    }
  }

  // Periodic poll for notifications & writing streak
  useEffect(() => {
    let mounted = true
    const fetchStatus = async () => {
      if (!user?.id) return
      try {
        const [notifs, streak] = await Promise.all([
          getNotifications(user.id),
          getWritingStreak(user.id)
        ])
        if (mounted) {
          setUnreadCount(notifs.filter(n => !n.is_read).length)
          setStreakDays(streak.currentStreak)
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
  }, [user?.id])

  return (
    <>
      <MobileNav
        onOpenNotifications={() => setNotifOpen(true)}
        unreadCount={unreadCount}
        streakDays={streakDays}
      />

      <div className={styles.layout}>
        <Sidebar
          onOpenNotifications={() => setNotifOpen(true)}
          unreadCount={unreadCount}
          streakDays={streakDays}
        />

        <main className={styles.main}>
          {hasAccountMismatch && (
            <div className={styles.mismatchBanner} role="alert">
              <div className={styles.mismatchText}>
                <span className={styles.mismatchIcon} aria-hidden="true">📬</span>
                <span>
                  This email link is for <strong>{intendedEmail}</strong>, but you are currently signed in as <strong>{currentEmail || 'another account'}</strong>.
                </span>
              </div>
              <div className={styles.mismatchActions}>
                <button
                  type="button"
                  className={styles.switchAccountBtn}
                  onClick={() => { void handleSwitchAccount() }}
                >
                  Switch to {intendedEmail} &rarr;
                </button>
                <button
                  type="button"
                  className={styles.stayAccountBtn}
                  onClick={handleDismissMismatch}
                >
                  Stay on {currentEmail || 'current'} ✕
                </button>
              </div>
            </div>
          )}
          <Outlet />
          <Footer />
        </main>
      </div>

      <NotificationDrawer
        open={isDrawerOpen}
        onClose={handleCloseNotifications}
        userId={user?.id || ''}
        onUnreadChange={count => setUnreadCount(count)}
      />
    </>
  )
}
