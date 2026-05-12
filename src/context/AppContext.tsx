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
  getThemeAwareUrl: (baseUrl: string) => string
  showToast: (message: string, type?: 'success' | 'error') => void
}

const AppContext = createContext<AppContextType>({} as AppContextType)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [theme, setTheme] = useState<Theme>(() => {
    // Check URL parameters for shared links
    const urlParams = new URLSearchParams(window.location.search)
    const urlTheme = urlParams.get('theme') as Theme | null
    
    // Default to light theme for shared links
    if (urlTheme) {
      localStorage.setItem('theme', urlTheme)
      return urlTheme
    }
    
    const saved = localStorage.getItem('theme') as Theme | null
    return saved || 'dark'
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      // Sync writer_profiles whenever user logs in (bootstraps existing users)
      if (session?.user) {
        const u = session.user
        const name = u.user_metadata?.full_name || ''
        const bio = u.user_metadata?.bio || ''
        const avatar = u.user_metadata?.avatar_url || ''
        upsertProfile(u.id, name, bio, avatar).catch(() => {})
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

  // Generate theme-aware URLs for sharing
  const getThemeAwareUrl = (baseUrl: string) => {
    const currentTheme = theme
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}theme=${currentTheme}`
  }

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <AppContext.Provider value={{ user, session, loading, toast, theme, toggleTheme, getThemeAwareUrl, showToast }}>
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
