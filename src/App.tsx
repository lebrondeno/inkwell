/**
 * Inkwell - A Modern Writing Platform
 * 
 * Built with ✦ by lebrondeno
 * GitHub: https://github.com/lebrondeno/inkwell
 * 
 * Features: Authentication, Article Management, Analytics, PWA
 * Tech Stack: React, TypeScript, Supabase, Vercel
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { AppProvider, useApp } from './context/AppContext'
import Landing from './pages/Landing'
import AppLayout from './pages/AppLayout'
import Dashboard from './pages/Dashboard'
import Articles from './pages/Articles'
import Editor from './pages/Editor'
import Analytics from './pages/Analytics'
import Profile from './pages/Profile'

function AppRoutes() {
  const { user, loading } = useApp()

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--accent)', fontSize: '32px'
      }}>
        ✦
      </div>
    )
  }

  if (!user) return <Landing />

  return (
    <Routes>
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="articles" element={<Articles />} />
        <Route path="write" element={<Editor />} />
        <Route path="write/:id" element={<Editor />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <VercelAnalytics />
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
