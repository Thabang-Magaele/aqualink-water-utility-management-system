import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { homePathFor } from './navigation'

/** /app sends each user to the right home for their role. */
export default function RoleHomeRedirect() {
  const { role } = useAuth()
  return <Navigate to={homePathFor(role)} replace />
}
