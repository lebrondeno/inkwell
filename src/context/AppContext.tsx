import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { supabase, upsertProfile } from '../lib/supabase'
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
}

const AppContext = createContext<AppContextType>({} as AppContextType)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    return saved || 'dark'
  })

  useEffect(() => {
    const ensureValidSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      // Handle stale sessions (common when token expired while app was closed).
      if (session?.expires_at && session.expires_at * 1000 <= Date.now()) {
        const { data, error } = await supabase.auth.refreshSession()
        if (error || !data.session) {
          await supabase.auth.signOut()
          setSession(null)
          setUser(null)
          setToast({ message: 'Session expired. Please sign in again.', type: 'error' })
          setLoading(false)
          return
        }
        setSession(data.session)
        setUser(data.session.user)
        setLoading(false)
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    ensureValidSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      // Sync writer_profiles whenever user logs in (bootstraps existing users)
      if (session?.user) {
        const u = session.user
        const name = u.user_metadata?.full_name || ''
        const bio = u.user_metadata?.bio || ''
        upsertProfile(u.id, name, bio).catch(() => {})
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <AppContext.Provider value={{ user, session, loading, toast, theme, toggleTheme, showToast }}>
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
