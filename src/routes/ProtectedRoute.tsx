import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import FullPageLoader from '../components/FullPageLoader'
import { useAuth } from '../hooks/useAuth'
import UnauthorizedPage from '../pages/UnauthorizedPage'
import type { Role } from '../types/user'

interface ProtectedRouteProps {
  /** If given, only these roles may enter. Omit to allow any signed-in user. */
  roles?: Role[]
  children?: ReactNode
}

/**
 * Handles the four auth states for a page:
 * Authenticating → loader, Unauthenticated → /login,
 * Unauthorized → access message, Authenticated → page.
 *
 * This only controls what the UI shows. Real protection is in
 * Firestore Security Rules and Cloud Functions.
 */
export default function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { status, role } = useAuth()
  const location = useLocation()

  if (status === 'authenticating') return <FullPageLoader />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (roles && (!role || !roles.includes(role))) return <UnauthorizedPage />

  return children ?? <Outlet />
}
