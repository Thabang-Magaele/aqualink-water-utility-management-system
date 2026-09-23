import { Route, Routes } from 'react-router-dom'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'

/**
 * Central route table. Phase 1 adds ProtectedRoute; Phase 2 adds role-based routes.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
