import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import { useAuth } from '../hooks/useAuth'
import { navFor } from '../routes/navigation'
import { ROLE_LABELS } from '../types/user'

/**
 * Signed-in shell with role-aware navigation.
 * Phase 2: functional and simple. Phase 3 replaces it with the full UI shell
 * (sidebar, mobile drawer, breadcrumbs) using the same navigation config.
 */
export default function AppLayout() {
  const { user, profile, role, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const navigate = useNavigate()
  const items = navFor(role)
  const name = profile?.displayName || user?.displayName || user?.email

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-mist border-b bg-white lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <p className="text-reservoir px-5 pt-4 pb-3 text-lg font-bold">AquaLink</p>
        <nav aria-label="Main">
          <ul className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
            {items.map(({ path, label, icon: Icon }) => (
              <li key={path} className="shrink-0">
                <NavLink
                  to={path}
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
                      isActive ? 'bg-reservoir text-white' : 'text-ink/80 hover:bg-mist'
                    }`
                  }
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-mist flex flex-wrap items-center justify-end gap-3 border-b bg-white px-6 py-3">
          <div className="text-right">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-ink/60 text-xs">{role ? ROLE_LABELS[role] : ''}</p>
          </div>
          <Button
            variant="secondary"
            loading={signingOut}
            onClick={async () => {
              setSigningOut(true)
              await signOut()
              // Clean login page: don't carry this user's last page to the next person.
              navigate('/login', { replace: true, state: null })
            }}
            icon={<LogOut className="size-4" aria-hidden="true" />}
          >
            Sign out
          </Button>
        </header>
        <main className="px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
