import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../hooks/useAuth'
import { navGroupsFor } from '../../routes/navigation'
import { ROLE_LABELS } from '../../types/user'

/** Staff home. Phase 6 adds live stats (tickets, invoices, outages) above these shortcuts. */
export default function StaffDashboardPage() {
  const { role, profile, user } = useAuth()
  const groups = navGroupsFor(role)
    .map((g) => ({ ...g, items: g.items.filter((i) => i.path !== '/staff') }))
    .filter((g) => g.items.length)

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile?.displayName || user?.displayName || user?.email}`}
        description={
          <>
            Signed in as <strong>{role ? ROLE_LABELS[role] : ''}</strong>. These are the areas your
            role can use.
          </>
        }
      />
      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.label ?? 'top'}>
            {group.label && (
              <h2 className="text-ink/55 mb-3 text-sm font-semibold tracking-wider uppercase">
                {group.label}
              </h2>
            )}
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map(({ path, label, icon: Icon }) => (
                <li key={path}>
                  <Link
                    to={path}
                    className="group border-mist hover:border-channel flex items-center gap-3 rounded-lg border bg-white px-4 py-4 font-semibold shadow-xs transition-colors"
                  >
                    <span className="bg-mist text-reservoir rounded-md p-2">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    {label}
                    <ChevronRight
                      className="text-ink/30 ml-auto size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
