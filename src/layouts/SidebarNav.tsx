import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { navGroupsFor } from '../routes/navigation'

/** Role-aware menu, used in the desktop sidebar and the mobile drawer. */
export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth()
  const groups = navGroupsFor(role)

  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-6">
      {groups.map((group) => (
        <div key={group.label ?? 'top'} className="mt-5 first:mt-2">
          {group.label && (
            <p className="text-mist/55 px-3 pb-1.5 text-xs font-semibold tracking-wider uppercase">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map(({ path, label, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'before:bg-mist bg-white/12 text-white before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full'
                        : 'text-mist/80 hover:bg-white/6 hover:text-white'
                    }`
                  }
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
