import { Navigate, Outlet, useLocation } from 'react-router-dom'
import FullPageLoader from '../components/FullPageLoader'
import { useAuth } from '../hooks/useAuth'

/**
 * For /login and /register: signed-in users are sent on to the app,
 * returning to the page they originally asked for when there is one.
 */
export default function GuestRoute() {
  const { status, registering } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (status === 'authenticating') return <FullPageLoader />
  if (status === 'authenticated' && !registering) {
    return <Navigate to={from && from !== '/login' ? from : '/app'} replace />
  }
  return <Outlet />
}
