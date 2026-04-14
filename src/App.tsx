import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { AppProvider, useApp } from './context/AppContext'
import Landing          from './pages/Landing'
import AppLayout        from './pages/AppLayout'
import Dashboard        from './pages/Dashboard'
import Articles         from './pages/Articles'
import Editor           from './pages/Editor'
import Analytics        from './pages/Analytics'
import Profile          from './pages/Profile'
import Bookmarks        from './pages/Bookmarks'
import PublicDiscover   from './pages/PublicDiscover'
import PublicArticle    from './pages/PublicArticle'
import PublicProfile    from './pages/PublicProfile'
import Communities      from './pages/community/Communities'
import CommunityPage    from './pages/community/CommunityPage'

function AppRoutes() {
  const { user, loading } = useApp()

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--accent)', fontSize:'32px' }}>
        <span style={{ animation:'spin 2s linear infinite', display:'block' }}>✦</span>
      </div>
    )
  }

  return (
    <Routes>
      {/* Fully public — no auth needed */}
      <Route path="/discover"          element={<PublicDiscover />} />
      <Route path="/articles/:slug"    element={<PublicArticle  />} />
      <Route path="/writer/:userId"    element={<PublicProfile  />} />
      <Route path="/communities"       element={<Communities    />} />
      <Route path="/c/:slug"           element={<CommunityPage  />} />

      {/* Protected */}
      {user ? (
        <>
          <Route path="/app" element={<AppLayout />}>
            <Route index                element={<Dashboard  />} />
            <Route path="articles"      element={<Articles   />} />
            <Route path="write"         element={<Editor     />} />
            <Route path="write/:id"     element={<Editor     />} />
            <Route path="analytics"     element={<Analytics  />} />
            <Route path="profile"       element={<Profile    />} />
            <Route path="bookmarks"     element={<Bookmarks  />} />
            <Route path="communities"   element={<Communities />} />
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </>
      ) : (
        <>
          <Route path="/"  element={<Landing />} />
          <Route path="*"  element={<Navigate to="/" replace />} />
        </>
      )}
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
