import { Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import NotificationBell from '../components/NotificationBell'
import UserMenu from '../components/UserMenu'
import { useAuth } from '../hooks/useAuth'
import Brand from './Brand'

export default function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { role } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="border-mist sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        className="text-ink/70 hover:bg-mist hover:text-ink -ml-1 rounded-md p-2 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <span className="lg:hidden">
        <Brand />
      </span>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {/* Live notifications arrive in Phase 12 */}
        <NotificationBell
          items={[]}
          onViewAll={role === 'customer' ? () => navigate('/customer/notifications') : undefined}
        />
        <UserMenu />
      </div>
    </header>
  )
}
