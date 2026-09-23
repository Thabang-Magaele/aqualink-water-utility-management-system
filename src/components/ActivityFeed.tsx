import {
  CircleDollarSign,
  FlaskConical,
  Megaphone,
  Receipt,
  ScrollText,
  Ticket,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ActivityItem, ActivityKind } from '../services/dashboardQueries'
import { formatDateTime, formatRelative } from '../utils/format'
import EmptyState from './EmptyState'
import ErrorState from './ErrorState'
import { Skeleton } from './LoadingSkeleton'
import StatusBadge from './StatusBadge'

const ICONS: Record<ActivityKind, LucideIcon> = {
  ticket: Ticket,
  invoice: Receipt,
  payment: CircleDollarSign,
  waterTest: FlaskConical,
  outage: Megaphone,
  audit: ScrollText,
}

interface ActivityFeedProps {
  items: ActivityItem[] | null
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
}

/** A time-ordered list of recent events. Used on dashboards. */
export default function ActivityFeed({
  items,
  loading,
  error,
  onRetry,
  emptyTitle = 'No recent activity',
  emptyDescription = 'Changes will appear here as work happens.',
}: ActivityFeedProps) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (loading || !items) {
    return (
      <ul className="divide-mist divide-y" aria-label="Loading activity">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex gap-3 px-5 py-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </li>
        ))}
      </ul>
    )
  }
  if (items.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />

  return (
    <ul className="divide-mist divide-y">
      {items.map((item) => {
        const Icon = ICONS[item.kind]
        const body = (
          <>
            <span className="bg-mist text-reservoir mt-0.5 rounded-full p-2">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{item.title}</span>
                {item.status && <StatusBadge status={item.status} />}
              </span>
              <span className="text-ink/65 mt-0.5 line-clamp-2 block text-sm">{item.detail}</span>
            </span>
            <time
              dateTime={item.at.toISOString()}
              title={formatDateTime(item.at)}
              className="text-ink/55 shrink-0 text-xs whitespace-nowrap"
            >
              {formatRelative(item.at)}
            </time>
          </>
        )
        return (
          <li key={item.id}>
            {item.to ? (
              <Link to={item.to} className="hover:bg-paper flex items-start gap-3 px-5 py-3.5">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-5 py-3.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
