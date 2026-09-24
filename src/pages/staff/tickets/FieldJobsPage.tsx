import { ChevronRight, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import EmptyState from '../../../components/EmptyState'
import ErrorState from '../../../components/ErrorState'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import PageHeader from '../../../components/PageHeader'
import StatusBadge from '../../../components/StatusBadge'
import { useAuth } from '../../../hooks/useAuth'
import { useSubscription } from '../../../hooks/useSubscription'
import { subscribeQueue, subscribeTechnicianJobs } from '../../../services/ticketService'
import type { Ticket } from '../../../types/models'
import { friendlyError } from '../../../utils/errors'
import { formatRelative } from '../../../utils/format'
import { placeLabel, PRIORITY_RANK, typeLabel } from '../../../utils/ticketDisplay'

/**
 * Technician: my assigned jobs, most urgent first. Admin: every assigned job.
 * Laid out as cards because technicians mostly use a phone.
 */
export default function FieldJobsPage() {
  const { role, user } = useAuth()
  const isTechnician = role === 'technician'
  const uid = user?.uid ?? ''
  const jobs = useSubscription(
    isTechnician ? subscribeTechnicianJobs(uid) : subscribeQueue,
    `field:${role}:${uid}`,
  )
  const [tab, setTab] = useState<'active' | 'resolved'>('active')

  const assigned = useMemo(
    () => (jobs.data ?? []).filter((t) => t.assignedTechnicianId),
    [jobs.data],
  )
  const active = useMemo(
    () =>
      assigned
        .filter((t) => t.status !== 'RESOLVED')
        .sort(
          (a, b) =>
            PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || statusRank(a) - statusRank(b),
        ),
    [assigned],
  )
  const resolved = useMemo(() => assigned.filter((t) => t.status === 'RESOLVED'), [assigned])
  const shown = tab === 'active' ? active : resolved

  return (
    <>
      <PageHeader
        title={isTechnician ? 'My jobs' : 'Field operations'}
        description={
          isTechnician
            ? 'Jobs assigned to you, most urgent first.'
            : 'Every job assigned to a technician.'
        }
      />
      <div className="mb-4 flex gap-2" role="group" aria-label="Show jobs">
        {(['active', 'resolved'] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? 'primary' : 'secondary'}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === 'active' ? 'Active' : 'Resolved'}
            {jobs.data && (
              <span
                className={`rounded-full px-1.5 text-xs ${tab === t ? 'bg-white/20' : 'bg-mist'}`}
              >
                {(t === 'active' ? active : resolved).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {jobs.loading && (
        <Card>
          <LoadingSkeleton lines={4} />
        </Card>
      )}
      {jobs.error ? (
        <Card>
          <ErrorState message={friendlyError(jobs.error)} />
        </Card>
      ) : null}
      {jobs.data && shown.length === 0 && (
        <Card>
          <EmptyState
            title={tab === 'active' ? 'No active jobs' : 'No resolved jobs yet'}
            description={
              tab === 'active'
                ? 'New assignments appear here and in your notifications.'
                : undefined
            }
          />
        </Card>
      )}
      {shown.length > 0 && (
        <ul
          className="grid gap-3 md:grid-cols-2"
          aria-label={tab === 'active' ? 'Active jobs' : 'Resolved jobs'}
        >
          {shown.map((t) => (
            <JobCard key={t.id} ticket={t} showTechnician={!isTechnician} />
          ))}
        </ul>
      )}
    </>
  )
}

const statusRank = (t: Ticket) => ({ IN_PROGRESS: 0, ESCALATED: 1, OPEN: 2, RESOLVED: 3 })[t.status]

function JobCard({ ticket: t, showTechnician }: { ticket: Ticket; showTechnician: boolean }) {
  return (
    <li>
      <Link
        to={`/staff/field/${t.id}`}
        className="group border-mist hover:border-channel flex h-full flex-col gap-3 rounded-lg border bg-white p-4 shadow-xs transition-colors"
      >
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block font-bold">{typeLabel(t.type)}</span>
            <span className="text-ink/60 block text-sm">{t.ticketNumber}</span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <StatusBadge status={t.priority} />
            <StatusBadge status={t.status} />
          </span>
        </span>
        <span className="flex items-start gap-2 text-sm">
          <MapPin className="text-ink/50 mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{placeLabel(t)}</span>
        </span>
        <span className="text-ink/60 mt-auto flex items-center justify-between text-sm">
          <span>
            {showTechnician && t.assignedTechnicianName ? `${t.assignedTechnicianName} · ` : ''}
            Updated {formatRelative(t.updatedAt)}
          </span>
          <ChevronRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  )
}
