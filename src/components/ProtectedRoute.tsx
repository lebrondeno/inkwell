import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useApp()
  const location = useLocation()

  if (!user) {
    const searchParams = new URLSearchParams(location.search)
    const intendedEmail = (
      searchParams.get('for') ||
      searchParams.get('email') ||
      ''
    ).trim()

    const fullPath = `${location.pathname}${location.search}`
    const loginParams = new URLSearchParams()
    if (intendedEmail) {
      loginParams.set('email', intendedEmail)
    }
    if (fullPath && fullPath !== '/') {
      loginParams.set('redirect', fullPath)
    }

    const qs = loginParams.toString()
    return <Navigate to={`/login${qs ? `?${qs}` : ''}`} replace />
  }

  return <>{children}</>
}
