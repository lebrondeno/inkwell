import { useState, useEffect } from 'react'
import styles from './PwaUpdateBanner.module.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const ICON_ACK_KEY = 'inkwell_icon_v10_ack'

export default function PwaUpdateBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [swWaiting, setSwWaiting] = useState<ServiceWorker | null>(null)
  const [updating, setUpdating] = useState(false)

  const [isStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  })

  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(ICON_ACK_KEY) !== 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    // 1. Capture native PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      try {
        if (localStorage.getItem(ICON_ACK_KEY) !== 'true') {
          setVisible(true)
        }
      } catch {
        setVisible(true)
      }
    }

    // 2. Allow manual trigger from Profile page ("Check for App Updates / Install Desktop App")
    const handleManualOpen = () => {
      setVisible(true)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          reg?.update().catch(() => {})
          if (reg?.waiting) setSwWaiting(reg.waiting)
        }).catch(() => {})
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('inkwell:open-pwa-banner', handleManualOpen)

    // 3. Detect waiting or newly installed Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return
        if (reg.waiting) {
          setSwWaiting(reg.waiting)
          setVisible(true)
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setSwWaiting(newWorker)
              setVisible(true)
            }
          })
        })
      }).catch(() => {})
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('inkwell:open-pwa-banner', handleManualOpen)
    }
  }, [])

  const handleUpdateAndApplyIcon = async () => {
    setUpdating(true)
    try {
      localStorage.setItem(ICON_ACK_KEY, 'true')
    } catch {
      // Ignore storage errors
    }

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        } else if (swWaiting) {
          swWaiting.postMessage({ type: 'SKIP_WAITING' })
        } else if (reg?.active) {
          reg.active.postMessage({ type: 'SKIP_WAITING' })
        }
        await reg?.update().catch(() => {})
      }

      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(
          keys.filter(k => k !== 'inkwell-v10').map(k => caches.delete(k))
        )
      }
    } catch {
      // Ignore SW/cache errors before reload
    }

    window.location.reload()
  }

  const handleInstallApp = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      try {
        localStorage.setItem(ICON_ACK_KEY, 'true')
      } catch {
        // Ignore storage errors
      }
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(ICON_ACK_KEY, 'true')
    } catch {
      // Ignore storage errors
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className={styles.card} role="region" aria-label="App update and icon notification">
      <button
        className={styles.dismissBtn}
        onClick={handleDismiss}
        title="Dismiss notification"
        aria-label="Dismiss notification"
      >
        ✕
      </button>

      <div className={styles.topRow}>
        <img
          src="/favicon.svg?v=10"
          alt="New Inkwell Squircle App Icon"
          className={styles.iconPreview}
        />
        <div className={styles.content}>
          <span className={styles.kicker}>✦ NEW EDITORIAL RELEASE · V10</span>
          <h4 className={styles.title}>New Classic Squircle Icon &amp; App Update</h4>
          <p className={styles.desc}>
            Update Inkwell to apply our new burnished-gold fountain nib icon and latest editorial features.
          </p>
        </div>
      </div>

      {isStandalone && (
        <div className={styles.standaloneNote}>
          Running the installed app? To refresh the Windows/Mac title-bar icon, click <strong>⋮</strong> in the top bar → <strong>Uninstall Inkwell</strong>, then click <strong>Install</strong> again.
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          onClick={handleUpdateAndApplyIcon}
          disabled={updating}
        >
          {updating ? 'Updating…' : '↻ Update & Apply New Icon'}
        </button>

        {deferredPrompt && (
          <button
            className={styles.installBtn}
            onClick={handleInstallApp}
          >
            ⬇ Install App
          </button>
        )}
      </div>
    </aside>
  )
}
