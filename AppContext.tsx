import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { supabase, upsertProfile, getWriterProfile } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

type Theme = 'dark' | 'light'

interface AppContextType {
  user: User | null
  session: Session | null
  loading: boolean
  toast: { message: string; type: 'success' | 'error' } | null
  theme: Theme
  toggleTheme: () => void
  showToast: (message: string, type?: 'success' | 'error') => void
  avatarUrl: string
  displayName: string
  refreshProfile: () => Promise<void>
}

const AppContext = createContext<AppContextType>({} as AppContextType)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast]     = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [avatarUrl, setAvatarUrl]     = useState('')
  const [displayName, setDisplayName] = useState('')
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  const loadProfile = async (u: User) => {
    // writer_profiles is the source of truth — auth metadata may be stale
    const profile = await getWriterProfile(u.id)
    setAvatarUrl(profile?.avatar_url || u.user_metadata?.avatar_url || '')
    setDisplayName(profile?.full_name || u.user_metadata?.full_name || u.email?.split('@')[0] || '')
  }

  const refreshProfile = async () => {
    if (user) await loadProfile(user)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) await loadProfile(session.user)
      setLoading(false)
    })

    // Track OS theme changes (only when user hasn't manually overridden)
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handleMQ = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) setTheme(e.matches ? 'light' : 'dark')
    }
    mq.addEventListener('change', handleMQ)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
        const u = session.user
        // Bootstrap writer_profiles row for new users
        upsertProfile(u.id, u.user_metadata?.full_name || '', u.user_metadata?.bio || '', u.user_metadata?.avatar_url || '').catch(() => {})
        await loadProfile(u)
      } else {
        setAvatarUrl('')
        setDisplayName('')
      }
    })

    return () => { subscription.unsubscribe(); mq.removeEventListener('change', handleMQ) }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <AppContext.Provider value={{ user, session, loading, toast, theme, toggleTheme, showToast, avatarUrl, displayName, refreshProfile }}>
      {children}
      {toast && (
        <div className={`toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.message}
        </div>
      )}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
