import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TONE_CLASSES, type Tone } from '../utils/status'
import { Skeleton } from './LoadingSkeleton'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  /** Short context line, e.g. "3 new today". */
  hint?: string
  tone?: Tone
  /** Makes the whole card a link to the related list. */
  to?: string
  loading?: boolean
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'info',
  to,
  loading,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink/65 text-sm font-semibold">{label}</p>
        {Icon && (
          <span className={`rounded-md p-2 ${TONE_CLASSES[tone].icon}`}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      )}
      {hint && !loading && <p className="text-ink/60 mt-1 text-sm">{hint}</p>}
    </>
  )
  const classes = 'block rounded-lg border border-mist bg-white p-5 shadow-xs'
  return to ? (
    <Link to={to} className={`${classes} hover:border-channel transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  )
}
