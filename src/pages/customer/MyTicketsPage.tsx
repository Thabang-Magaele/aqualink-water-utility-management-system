import { TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Card from '../../components/Card'
import DataTable, { type Column } from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { useSubscription } from '../../hooks/useSubscription'
import { subscribeCustomerTickets } from '../../services/ticketService'
import type { Ticket } from '../../types/models'
import { friendlyError } from '../../utils/errors'
import { formatDate } from '../../utils/format'
import { typeLabel } from '../../utils/ticketDisplay'

const columns: Column<Ticket>[] = [
  {
    key: 'number',
    header: 'Report',
    render: (t) => (
      <span>
        <span className="block font-semibold">{typeLabel(t.type)}</span>
        <span className="text-ink/60 block text-sm">{t.ticketNumber}</span>
      </span>
    ),
  },
  { key: 'location', header: 'Location', render: (t) => t.location },
  { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
  { key: 'reported', header: 'Reported', align: 'right', render: (t) => formatDate(t.createdAt) },
]

/** Customer: their reports, updating live as staff work on them. */
export default function MyTicketsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid
  const tickets = useSubscription(uid ? subscribeCustomerTickets(uid) : null, `my-tickets:${uid}`)

  return (
    <>
      <PageHeader
        title="My tickets"
        description="Problems you’ve reported and where they are. This page updates by itself."
        actions={
          <Link
            to="/customer/report"
            className="bg-reservoir hover:bg-reservoir-deep inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-semibold text-white"
          >
            <TriangleAlert className="size-4" aria-hidden="true" /> Report a problem
          </Link>
        }
      />
      <Card padded={false}>
        <DataTable
          caption="My tickets"
          columns={columns}
          rows={tickets.data}
          getRowId={(t) => t.id}
          loading={tickets.loading}
          error={tickets.error ? friendlyError(tickets.error) : null}
          onRowClick={(t) => navigate(`/customer/tickets/${t.id}`)}
          pageSize={10}
          emptyTitle="No reports yet"
          emptyDescription="When you report a leak or outage, you can follow it here."
        />
      </Card>
    </>
  )
}
