import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/supabase'
import type { Notification } from '../lib/supabase'
import styles from './NotificationDrawer.module.css'

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  onUnreadChange?: (count: number) => void
}

export default function NotificationDrawer({ open, onClose, userId, onUnreadChange }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const loadNotifications = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const list = await getNotifications(userId)
      setNotifications(list)
      const unread = list.filter(n => !n.is_read).length
      onUnreadChange?.(unread)
    } finally {
      setLoading(false)
    }
  }, [userId, onUnreadChange])

  useEffect(() => {
    if (open && userId) {
      loadNotifications()
    }
  }, [open, userId, loadNotifications])

  if (!open) return null

  const unreadCount = notifications.filter(n => !n.is_read).length

  const handleItemClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
      onUnreadChange?.(Math.max(0, unreadCount - 1))
    }
    const targetLink =
      notif.link ||
      (notif.type === 'new_follower' && notif.actor_id
        ? `/author/${notif.actor_id}`
        : '')
    if (targetLink) {
      onClose()
      navigate(targetLink)
    }
  }

  const handleMarkAll = async () => {
    await markAllNotificationsRead(userId)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    onUnreadChange?.(0)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_follower': return '👤'
      case 'new_article':  return '📖'
      case 'mention':      return '💬'
      default:             return '✦'
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Notifications</h3>
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
          </div>
          <div className={styles.actions}>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={handleMarkAll}>
                Mark all read
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close notifications">
              ×
            </button>
          </div>
        </div>

        <div className={styles.list}>
          {loading && notifications.length === 0 ? (
            <div className={styles.empty}>Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔔</div>
              <p>No notifications yet</p>
              <span style={{ fontSize: '12px' }}>
                When readers follow you or published writers post stories, updates will appear here.
              </span>
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                className={`${styles.item} ${!notif.is_read ? styles.unread : ''}`}
                onClick={() => handleItemClick(notif)}
              >
                <span className={styles.itemIcon}>{getIcon(notif.type)}</span>
                <div className={styles.itemContent}>
                  <p className={styles.itemTitle}>{notif.title}</p>
                  <p className={styles.itemMessage}>{notif.message}</p>
                  <span className={styles.itemTime}>
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </span>
                </div>
                {!notif.is_read && <span className={styles.dot} />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
