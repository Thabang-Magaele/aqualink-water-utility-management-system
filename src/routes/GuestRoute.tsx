import { Navigate, Outlet, useLocation } from 'react-router-dom'
import FullPageLoader from '../components/FullPageLoader'
import { useAuth } from '../hooks/useAuth'
import { canOpen, homePathFor } from './navigation'

/**
 * For /login and /register: signed-in users are sent on to the app.
 * They return to the page they originally asked for only if their role can
 * open it (e.g. not the previous user's page on a shared computer).
 */
export default function GuestRoute() {
  const { status, registering, role } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (status === 'authenticating') return <FullPageLoader />
  if (status === 'authenticated' && !registering) {
    const target = from && canOpen(role, from) ? from : homePathFor(role)
    return <Navigate to={target} replace />
  }
  return <Outlet />
}
