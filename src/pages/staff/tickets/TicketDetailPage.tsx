import { ArrowLeft, SearchX } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Card from '../../../components/Card'
import EmptyState from '../../../components/EmptyState'
import ErrorState from '../../../components/ErrorState'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import PageHeader from '../../../components/PageHeader'
import StatusBadge from '../../../components/StatusBadge'
import TicketTimeline from '../../../components/tickets/TicketTimeline'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { useSubscription } from '../../../hooks/useSubscription'
import { canOpen } from '../../../routes/navigation'
import { ticketPermissions, type Actor } from '../../../services/ticketActions'
import { loadAssets, subscribeHistory, subscribeTicket } from '../../../services/ticketService'
import { friendlyError } from '../../../utils/errors'
import { formatDateTime } from '../../../utils/format'
import { placeLabel, typeLabel } from '../../../utils/ticketDisplay'
import TicketActionsCard from './TicketActionsCard'

const SECTIONS = {
  '/staff/tickets': 'Tickets',
  '/staff/field': 'Field Operations',
} as const

/** One ticket for staff. Shared by the call-centre queue and technicians' jobs. */
export default function TicketDetailPage({ section }: { section: keyof typeof SECTIONS }) {
  const { ticketId = '' } = useParams()
  const { role, user, profile } = useAuth()
  const ticket = useSubscription(subscribeTicket(ticketId), `ticket:${ticketId}`)
  const history = useSubscription(subscribeHistory(ticketId), `history:${ticketId}`)
  const t = ticket.data
  const assets = useAsync(t?.assetId ? loadAssets : null, `assets-for:${t?.assetId}`)
  const crumbs = [
    { label: 'Staff console', to: '/staff' },
    { label: SECTIONS[section], to: section },
  ]

  if (ticket.loading) {
    return (
      <>
        <PageHeader title="Ticket" breadcrumbs={[...crumbs, { label: 'Loading…' }]} />
        <Card>
          <LoadingSkeleton lines={6} />
        </Card>
      </>
    )
  }
  if (ticket.error || !t) {
    const missing =
      !ticket.error || (ticket.error as { code?: string }).code === 'permission-denied'
    return (
      <>
        <PageHeader title="Ticket" breadcrumbs={[...crumbs, { label: 'Not found' }]} />
        <Card>
          {missing ? (
            <EmptyState
              icon={SearchX}
              title="Ticket not available"
              description="It doesn't exist, or it isn't assigned to you."
              action={
                <Link
                  to={section}
                  className="text-channel inline-flex items-center gap-1 font-semibold hover:underline"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" /> Back to{' '}
                  {SECTIONS[section].toLowerCase()}
                </Link>
              }
            />
          ) : (
            <ErrorState message={friendlyError(ticket.error)} />
          )}
        </Card>
      </>
    )
  }

  const actor: Actor = {
    uid: user?.uid ?? '',
    name: profile?.displayName || user?.displayName || user?.email || 'Staff',
    role: role!,
  }
  const can = ticketPermissions(role, t, user?.uid)
  const customerPath = `/staff/customers/${t.customerId}`
  const asset = assets.data?.find((a) => a.id === t.assetId)

  return (
    <>
      <PageHeader
        title={`${typeLabel(t.type)}: ${t.ticketNumber}`}
        breadcrumbs={[...crumbs, { label: t.ticketNumber }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <StatusBadge status={t.priority} />
            <span>
              {t.area} · reported {formatDateTime(t.createdAt)}
            </span>
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details" padded={false}>
            <dl className="divide-mist grid divide-y text-sm sm:grid-cols-2 sm:divide-y-0">
              <Row label="Location" value={placeLabel(t)} />
              <Row
                label="Customer"
                value={
                  canOpen(role, customerPath) ? (
                    <Link to={customerPath} className="text-channel font-semibold hover:underline">
                      {t.customerName}
                    </Link>
                  ) : (
                    t.customerName
                  )
                }
              />
              <Row
                label="Technician"
                value={
                  t.assignedTechnicianName ?? (
                    <span className="text-signal-ink font-semibold">Unassigned</span>
                  )
                }
              />
              <Row
                label="Related asset"
                value={t.assetId ? (asset ? `${asset.code}: ${asset.name}` : '…') : 'None'}
              />
              {t.resolvedAt && <Row label="Resolved" value={formatDateTime(t.resolvedAt)} />}
            </dl>
            <div className="border-mist border-t px-5 py-4">
              <p className="text-ink/60 text-sm font-semibold">Description</p>
              <p className="mt-1 whitespace-pre-line">{t.description}</p>
            </div>
          </Card>
          <Card title="History">
            {history.error ? (
              <ErrorState message={friendlyError(history.error)} />
            ) : history.data ? (
              <TicketTimeline entries={history.data} />
            ) : (
              <LoadingSkeleton lines={3} />
            )}
          </Card>
        </div>
        <div className="order-first lg:order-none">
          <TicketActionsCard
            key={`${t.id}:${t.priority}:${t.assetId}`}
            ticket={t}
            actor={actor}
            can={can}
          />
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-3">
      <dt className="text-ink/60 font-semibold">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  )
}
