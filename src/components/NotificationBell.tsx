import { Bell, BellOff } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { formatRelative } from '../utils/format'

export interface BellItem {
  id: string
  title: string
  message: string
  createdAt: Date
  read: boolean
}

interface NotificationBellProps {
  items: BellItem[]
  onSelect?: (item: BellItem) => void
  onMarkAllRead?: () => void
  /** Link to the full notifications page. */
  onViewAll?: () => void
}

/**
 * Top-bar bell with unread count and a dropdown of recent notifications.
 * Presentational: Phase 12 supplies live data from Firestore.
 */
export default function NotificationBell({
  items,
  onSelect,
  onMarkAllRead,
  onViewAll,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const unread = items.filter((i) => !i.read).length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="text-ink/70 hover:bg-mist hover:text-ink relative rounded-md p-2"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="bg-fault absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="border-mist absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-white shadow-lg">
          <div className="border-mist flex items-center justify-between border-b px-4 py-3">
            <p className="font-bold">Notifications</p>
            {unread > 0 && onMarkAllRead && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-channel text-sm font-semibold hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <BellOff className="text-ink/35 size-6" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold">You're all caught up</p>
              <p className="text-ink/60 mt-0.5 text-sm">
                Updates about tickets, bills and outages appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-mist max-h-96 divide-y overflow-y-auto">
              {items.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect?.(item)
                      close()
                    }}
                    className="hover:bg-paper flex w-full gap-3 px-4 py-3 text-left"
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? 'bg-transparent' : 'bg-channel'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className={`block text-sm ${item.read ? '' : 'font-semibold'}`}>
                        {item.title}
                        {!item.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="text-ink/65 mt-0.5 line-clamp-2 block text-sm">
                        {item.message}
                      </span>
                      <span className="text-ink/50 mt-1 block text-xs">
                        {formatRelative(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {onViewAll && (
            <button
              type="button"
              onClick={() => {
                onViewAll()
                close()
              }}
              className="border-mist text-channel hover:bg-paper block w-full border-t px-4 py-2.5 text-center text-sm font-semibold"
            >
              View all notifications
            </button>
          )}
        </div>
      )}
    </div>
  )
}
