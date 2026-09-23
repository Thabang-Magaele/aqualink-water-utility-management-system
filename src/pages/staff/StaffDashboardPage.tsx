import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { navFor } from '../../routes/navigation'
import { ROLE_LABELS } from '../../types/user'

/** Phase 2 staff home: shows which sections this role can use. Phase 6 adds real data. */
export default function StaffDashboardPage() {
  const { role, profile, user } = useAuth()
  const sections = navFor(role).filter((item) => item.path !== '/staff')

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">
        Welcome, {profile?.displayName || user?.displayName || user?.email}
      </h1>
      <p className="text-ink/70 mt-2">
        Signed in as <strong>{role ? ROLE_LABELS[role] : ''}</strong>. These are the areas your role
        can use.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <Link
              to={path}
              className="border-mist hover:border-channel flex items-center gap-3 rounded-lg border bg-white px-4 py-4 font-semibold"
            >
              <Icon className="text-reservoir size-5" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
