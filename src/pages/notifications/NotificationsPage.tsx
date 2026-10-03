import { BellOff, CheckCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import { controlClass } from '../../components/formStyles'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../hooks/useAuth'
import { useSubscription } from '../../hooks/useSubscription'
import { useToast } from '../../hooks/useToast'
import {
  markAllNotificationsRead,
  PAGE_LIMIT,
  subscribeMyNotifications,
} from '../../services/notificationService'
import { NOTIFICATION_TYPES, type NotificationType } from '../../types/models'
import { friendlyError } from '../../utils/errors'
import { formatDateTime, formatRelative } from '../../utils/format'
import { kindOf, NOTIFICATION_KINDS, notificationsPath } from '../../utils/notifications'

/** Everything the signed-in user has been notified about, newest first, live. */
export default function NotificationsPage() {
  const { user, role } = useAuth()
  const { toast } = useToast()
  const uid = user?.uid
  const live = useSubscription(
    uid ? subscribeMyNotifications(uid, PAGE_LIMIT) : null,
    `notifications:${uid}`,
  )
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [type, setType] = useState<NotificationType | 'all'>('all')
  const [marking, setMarking] = useState(false)
  const base = notificationsPath(role)
  const home =
    role === 'customer'
      ? { label: 'My AquaLink', to: '/customer' }
      : { label: 'Staff console', to: '/staff' }

  const all = live.data
  const unread = (all ?? []).filter((n) => !n.read)
  const shown = useMemo(
    () =>
      (all ?? []).filter((n) => (tab === 'all' || !n.read) && (type === 'all' || n.type === type)),
    [all, tab, type],
  )
  const typesPresent = NOTIFICATION_TYPES.filter((t) => (all ?? []).some((n) => n.type === t))

  async function markAll() {
    setMarking(true)
    try {
      await markAllNotificationsRead(unread.map((n) => n.id))
      toast({
        title: 'All caught up',
        message: `${unread.length} notification${unread.length === 1 ? '' : 's'} marked as read.`,
      })
    } catch (error) {
      toast({ tone: 'error', title: 'Couldn’t mark them as read', message: friendlyError(error) })
    } finally {
      setMarking(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        breadcrumbs={[home, { label: 'Notifications' }]}
        description="Updates about tickets, bills, payments and outages. New ones appear here as they happen."
        actions={
          <Button
            variant="secondary"
            onClick={markAll}
            loading={marking}
            disabled={!unread.length}
            icon={<CheckCheck className="size-4" aria-hidden="true" />}
          >
            Mark all as read
          </Button>
        }
      />
      <Card padded={false}>
        <div className="border-mist flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1" role="group" aria-label="Show">
            {(['all', 'unread'] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? 'primary' : 'secondary'}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t === 'all' ? 'All' : 'Unread'}
                <span className="ml-1 tabular-nums opacity-80">
                  {t === 'all' ? (all?.length ?? 0) : unread.length}
                </span>
              </Button>
            ))}
          </div>
          {typesPresent.length > 1 && (
            <>
              <label className="sr-only" htmlFor="notification-type">
                Filter by type
              </label>
              <select
                id="notification-type"
                value={type}
                onChange={(e) => setType(e.target.value as NotificationType | 'all')}
                className={`${controlClass(false)} sm:w-48`}
              >
                <option value="all">All types</option>
                {typesPresent.map((t) => (
                  <option key={t} value={t}>
                    {NOTIFICATION_KINDS[t].label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {live.loading && (
          <div className="p-5">
            <LoadingSkeleton lines={4} label="Loading notifications…" />
          </div>
        )}
        {live.error ? <ErrorState message={friendlyError(live.error)} /> : null}
        {all && shown.length === 0 && (
          <EmptyState
            icon={BellOff}
            title={tab === 'unread' ? 'You’re all caught up' : 'No notifications yet'}
            description={
              tab === 'unread'
                ? 'Nothing unread.'
                : 'Updates about tickets, bills and outages will appear here.'
            }
          />
        )}
        {all && shown.length > 0 && (
          <ul className="divide-mist divide-y" aria-label="Notifications">
            {shown.map((n) => {
              const kind = kindOf(n.type)
              const Icon = kind.icon
              const when = n.createdAt?.toDate?.() ?? null
              return (
                <li key={n.id}>
                  <Link
                    to={`${base}/${n.id}`}
                    className={`hover:bg-paper flex gap-3 px-4 py-3.5 sm:px-5 ${n.read ? '' : 'bg-channel/[0.04]'}`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 self-start rounded-md p-2 ${n.read ? 'bg-mist text-ink/60' : 'bg-channel/10 text-channel'}`}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`min-w-0 truncate ${n.read ? '' : 'font-semibold'}`}>
                          {/* Before the title: after a truncated title it would sit off-screen and widen the page */}
                          {!n.read && <span className="sr-only">Unread: </span>}
                          {n.title}
                        </span>
                        <time
                          className="text-ink/50 shrink-0 text-xs"
                          dateTime={when?.toISOString()}
                          title={when ? formatDateTime(when) : undefined}
                        >
                          {when ? formatRelative(when) : ''}
                        </time>
                      </span>
                      <span className="text-ink/70 mt-0.5 line-clamp-2 block text-sm">
                        {n.message}
                      </span>
                      <span className="text-ink/50 mt-1 block text-xs">{kind.label}</span>
                    </span>
                    {!n.read && (
                      <span
                        className="bg-channel mt-2 size-2 shrink-0 rounded-full"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {all && all.length >= PAGE_LIMIT && (
          <p className="border-mist text-ink/60 border-t px-4 py-2 text-sm">
            Showing your latest {PAGE_LIMIT} notifications.
          </p>
        )}
      </Card>
    </>
  )
}
