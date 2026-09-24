import { ArrowLeft, SearchX } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import TicketProgress from '../../components/tickets/TicketProgress'
import TicketTimeline from '../../components/tickets/TicketTimeline'
import { useSubscription } from '../../hooks/useSubscription'
import { ticketProgress } from '../../services/ticketActions'
import { subscribeHistory, subscribeTicket } from '../../services/ticketService'
import { friendlyError } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'
import { placeLabel, typeLabel } from '../../utils/ticketDisplay'

const CRUMBS = [
  { label: 'My AquaLink', to: '/customer' },
  { label: 'My tickets', to: '/customer/tickets' },
]

/** Customer: one report, with live progress and every update. */
export default function CustomerTicketPage() {
  const { ticketId = '' } = useParams()
  const ticket = useSubscription(subscribeTicket(ticketId), `ticket:${ticketId}`)
  const history = useSubscription(subscribeHistory(ticketId), `history:${ticketId}`)
  const t = ticket.data

  if (ticket.loading) {
    return (
      <>
        <PageHeader title="Report" breadcrumbs={[...CRUMBS, { label: 'Loading…' }]} />
        <Card>
          <LoadingSkeleton lines={5} />
        </Card>
      </>
    )
  }
  if (ticket.error || !t) {
    return (
      <>
        <PageHeader title="Report" breadcrumbs={[...CRUMBS, { label: 'Not found' }]} />
        <Card>
          {ticket.error && (ticket.error as { code?: string }).code !== 'permission-denied' ? (
            <ErrorState message={friendlyError(ticket.error)} />
          ) : (
            <EmptyState
              icon={SearchX}
              title="We couldn't find this report"
              description="It may belong to another account, or the link is wrong."
              action={
                <Link
                  to="/customer/tickets"
                  className="text-channel inline-flex items-center gap-1 font-semibold hover:underline"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" /> Back to my tickets
                </Link>
              }
            />
          )}
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={`${typeLabel(t.type)} report`}
        breadcrumbs={[...CRUMBS, { label: t.ticketNumber }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {t.ticketNumber} <StatusBadge status={t.status} />
          </span>
        }
      />
      <div className="space-y-6">
        <TicketProgress steps={ticketProgress(t)} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Your report" padded={false}>
            <dl className="divide-mist divide-y text-sm">
              <Row label="Location" value={placeLabel(t)} />
              <Row label="Reported" value={formatDateTime(t.createdAt)} />
              <Row label="Technician" value={t.assignedTechnicianName ?? 'Not assigned yet'} />
              {t.resolvedAt && <Row label="Resolved" value={formatDateTime(t.resolvedAt)} />}
              <Row label="What you told us" value={t.description} />
            </dl>
          </Card>
          <Card title="Updates" className="lg:col-span-2">
            {history.error ? (
              <ErrorState message={friendlyError(history.error)} />
            ) : history.data ? (
              <TicketTimeline entries={history.data} />
            ) : (
              <LoadingSkeleton lines={3} />
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3">
      <dt className="text-ink/60 font-semibold">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  )
}
