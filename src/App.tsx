import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { Auth } from './pages/Auth'
import { CreateWishlist } from './pages/CreateWishlist'
import { Dashboard } from './pages/Dashboard'
import { EditWishlist } from './pages/EditWishlist'
import { Landing } from './pages/Landing'
import { PublicWishlist } from './pages/PublicWishlist'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/w/:slug" element={<PublicWishlist />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wishlist/new"
              element={
                <ProtectedRoute>
                  <CreateWishlist />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wishlist/:slug/edit"
              element={
                <ProtectedRoute>
                  <EditWishlist />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  )
}
