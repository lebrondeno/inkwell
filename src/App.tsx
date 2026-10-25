import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { AppProvider, useApp } from './context/AppContext'
import Landing           from './pages/Landing'
import Login             from './pages/Login'
import AppLayout         from './pages/AppLayout'
import Dashboard         from './pages/Dashboard'
import Articles          from './pages/Articles'
import Editor            from './pages/Editor'
import Analytics         from './pages/Analytics'
import Profile           from './pages/Profile'
import Bookmarks         from './pages/Bookmarks'
import SeriesPage        from './pages/SeriesPage'
import PublicDiscover    from './pages/PublicDiscover'
import PublicArticle     from './pages/PublicArticle'
import PublicProfile     from './pages/PublicProfile'
import Communities       from './pages/community/Communities'
import CommunityPage     from './pages/community/CommunityPage'
import ResetPassword     from './pages/ResetPassword'
import ProtectedRoute    from './components/ProtectedRoute'
import PwaUpdateBanner   from './components/PwaUpdateBanner'
import GlobalSearchModal from './components/GlobalSearchModal'

function AppRoutes() {
  const { user, loading, isPasswordRecovery } = useApp()

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--accent)', fontSize:'32px' }}>
        <span style={{ animation:'spin 2s linear infinite', display:'block' }}>✦</span>
      </div>
    )
  }

  if (isPasswordRecovery) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/reset-password" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      {/* Fully public — no auth needed */}
      <Route path="/discover"          element={<PublicDiscover />} />
      <Route path="/articles/:slug"    element={<PublicArticle  />} />
      <Route path="/p/:slug"           element={<PublicArticle  />} />
      <Route path="/writer/:userId"    element={<PublicProfile  />} />
      <Route path="/author/:userId"    element={<PublicProfile  />} />
      <Route path="/communities"       element={<Communities    />} />
      <Route path="/c/:slug"           element={<CommunityPage  />} />
      <Route path="/reset-password"    element={<ResetPassword  />} />
      <Route path="/login"             element={<Login          />} />

      {/* Protected Studio Routes (preserves ?for= & ?notifications=open when logged out) */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index                element={<Dashboard  />} />
        <Route path="articles"      element={<Articles   />} />
        <Route path="write"         element={<Editor     />} />
        <Route path="write/:id"     element={<Editor     />} />
        <Route path="analytics"     element={<Analytics  />} />
        <Route path="profile"       element={<Profile    />} />
        <Route path="bookmarks"     element={<Bookmarks  />} />
        <Route path="series"        element={<SeriesPage />} />
        <Route path="communities"   element={<Communities />} />
      </Route>

      {/* Root & fallback */}
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <Landing />} />
      <Route path="*" element={<Navigate to={user ? '/app' : '/'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <VercelAnalytics />
        <AppRoutes />
        <GlobalSearchModal />
        <PwaUpdateBanner />
      </AppProvider>
    </BrowserRouter>
  )
}
