import { Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeMyNotifications,
} from '../services/notificationService'
import NotificationBell from '../components/NotificationBell'
import UserMenu from '../components/UserMenu'
import { useAuth } from '../hooks/useAuth'
import Brand from './Brand'

export default function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { role, user } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid
  const live = useSubscription(uid ? subscribeMyNotifications(uid) : null, `bell:${uid}`)
  const notifications = live.data ?? []
  const items = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt?.toDate?.() ?? new Date(),
  }))

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
        <NotificationBell
          items={items}
          onSelect={(item) => {
            const n = notifications.find((x) => x.id === item.id)
            if (n && !n.read) markNotificationRead(n.id).catch(() => {})
            if (n?.link) navigate(n.link)
          }}
          onMarkAllRead={() =>
            markAllNotificationsRead(notifications.filter((n) => !n.read).map((n) => n.id)).catch(
              () => {},
            )
          }
          onViewAll={role === 'customer' ? () => navigate('/customer/notifications') : undefined}
        />
        <UserMenu />
      </div>
    </header>
  )
}
