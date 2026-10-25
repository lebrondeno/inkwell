import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getNotifications, getWritingStreak } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import MobileNav from '../components/MobileNav'
import NotificationDrawer from '../components/NotificationDrawer'
import Footer from '../components/Footer'
import styles from './AppLayout.module.css'

export default function AppLayout() {
  const { user } = useApp()
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [streakDays, setStreakDays] = useState(0)

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
          <Outlet />
          <Footer />
        </main>
      </div>

      <NotificationDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        userId={user?.id || ''}
        onUnreadChange={count => setUnreadCount(count)}
      />
    </>
  )
}
