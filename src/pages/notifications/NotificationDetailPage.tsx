import { ArrowLeft, ArrowRight, BellOff, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import PageHeader from '../../components/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import {
  loadNotification,
  markNotificationRead,
  markNotificationUnread,
} from '../../services/notificationService'
import { friendlyError } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'
import { kindOf, notificationsPath } from '../../utils/notifications'

/** One notification in full. Opening it marks it read. */
export default function NotificationDetailPage() {
  const { notificationId = '' } = useParams()
  const { role } = useAuth()
  const { toast } = useToast()
  const detail = useAsync(() => loadNotification(notificationId), `notification:${notificationId}`)
  const [unread, setUnread] = useState(false)
  const base = notificationsPath(role)
  const crumbs = [
    role === 'customer'
      ? { label: 'My AquaLink', to: '/customer' }
      : { label: 'Staff console', to: '/staff' },
    { label: 'Notifications', to: base },
  ]
  const n = detail.data

  // Opening a notification counts as reading it
  useEffect(() => {
    if (n && !n.read) markNotificationRead(n.id).catch(() => {})
  }, [n])

  if (detail.loading)
    return (
      <>
        <PageHeader title="Notification" breadcrumbs={[...crumbs, { label: 'Loading…' }]} />
        <Card>
          <LoadingSkeleton lines={3} />
        </Card>
      </>
    )

  const back = (
    <Link
      to={base}
      className="text-channel inline-flex items-center gap-1 font-semibold hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> Back to notifications
    </Link>
  )
  if (detail.error || !n) {
    const denied = (detail.error as { code?: string } | undefined)?.code === 'permission-denied'
    return (
      <>
        <PageHeader title="Notification" breadcrumbs={[...crumbs, { label: 'Not available' }]} />
        <Card>
          {detail.error && !denied ? (
            <ErrorState message={friendlyError(detail.error)} onRetry={detail.reload} />
          ) : (
            <EmptyState
              icon={BellOff}
              title="This notification isn’t available"
              description="It may have been removed, or it belongs to someone else."
              action={back}
            />
          )}
        </Card>
      </>
    )
  }

  const kind = kindOf(n.type)
  const Icon = kind.icon
  async function markUnread() {
    try {
      await markNotificationUnread(n!.id)
      setUnread(true)
      toast({ title: 'Marked as unread' })
    } catch (error) {
      toast({ tone: 'error', title: 'Couldn’t mark as unread', message: friendlyError(error) })
    }
  }

  return (
    <>
      <PageHeader title={n.title} breadcrumbs={[...crumbs, { label: kind.label }]} />
      <Card className="max-w-2xl">
        <p className="text-ink/60 flex items-center gap-2 text-sm">
          <span className="bg-channel/10 text-channel rounded-md p-1.5">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          {kind.label} · {formatDateTime(n.createdAt)}
        </p>
        <p className="mt-4 text-lg leading-relaxed whitespace-pre-line">{n.message}</p>
        <div className="border-mist mt-6 flex flex-wrap items-center gap-3 border-t pt-4">
          {n.link && (
            <Link
              to={n.link}
              className="bg-reservoir hover:bg-reservoir-deep inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-semibold text-white"
            >
              {kind.open} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
          <Button
            variant="secondary"
            onClick={markUnread}
            disabled={unread}
            icon={<Mail className="size-4" aria-hidden="true" />}
          >
            {unread ? 'Marked as unread' : 'Mark as unread'}
          </Button>
          <span className="ml-auto">{back}</span>
        </div>
      </Card>
    </>
  )
}
