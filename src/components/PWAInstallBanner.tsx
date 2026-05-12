import { useState, useEffect } from 'react'
import styles from './PWAInstallBanner.module.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Already running as installed PWA — never show
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    if (isStandalone) return

    // User already permanently dismissed
    if (localStorage.getItem('pwa-banner-dismissed') === 'true') return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // On iOS, beforeinstallprompt never fires — show the manual tip instead
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    if (isIOS) {
      // Small delay so the page settles first
      const t = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(t)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = (permanent: boolean) => {
    setVisible(false)
    setDismissed(true)
    if (permanent) localStorage.setItem('pwa-banner-dismissed', 'true')
  }

  if (!visible || dismissed) return null

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)

  return (
    <div className={styles.banner} role="banner" aria-live="polite">
      <div className={styles.icon}>✦</div>
      <div className={styles.text}>
        <strong>Install Inkwell</strong>
        {isIOS ? (
          <span>
            Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong> for the full app experience.
          </span>
        ) : (
          <span>Get the full app — faster, offline, no browser chrome.</span>
        )}
      </div>
      <div className={styles.actions}>
        {!isIOS && (
          <button className={styles.install} onClick={handleInstall}>
            Install
          </button>
        )}
        <button className={styles.later} onClick={() => handleDismiss(false)} title="Remind me later">
          Later
        </button>
        <button className={styles.close} onClick={() => handleDismiss(true)} title="Don't show again" aria-label="Dismiss permanently">
          ✕
        </button>
      </div>
    </div>
  )
}
