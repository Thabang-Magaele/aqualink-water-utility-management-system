import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import DataTable, { type Column } from '../../../components/DataTable'
import { controlClass } from '../../../components/formStyles'
import PageHeader from '../../../components/PageHeader'
import SearchBar from '../../../components/SearchBar'
import StatusBadge from '../../../components/StatusBadge'
import { useAuth } from '../../../hooks/useAuth'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useSubscription } from '../../../hooks/useSubscription'
import { subscribeQueue } from '../../../services/ticketService'
import {
  AREAS,
  PRIORITIES,
  type Area,
  type Priority,
  type Ticket,
  type TicketStatus,
} from '../../../types/models'
import { friendlyError } from '../../../utils/errors'
import { formatRelative } from '../../../utils/format'
import { matchesTicket, placeLabel, PRIORITY_RANK, typeLabel } from '../../../utils/ticketDisplay'
import LogTicketModal from './LogTicketModal'

const VIEWS: { id: string; label: string; statuses: TicketStatus[] | null }[] = [
  { id: 'action', label: 'Needs action', statuses: ['OPEN', 'ESCALATED'] },
  { id: 'progress', label: 'In progress', statuses: ['IN_PROGRESS'] },
  { id: 'resolved', label: 'Resolved', statuses: ['RESOLVED'] },
  { id: 'all', label: 'All', statuses: null },
]

const columns: Column<Ticket>[] = [
  {
    key: 'ticket',
    header: 'Ticket',
    sortValue: (t) => t.ticketNumber,
    render: (t) => (
      <span>
        <span className="block font-semibold">{typeLabel(t.type)}</span>
        <span className="text-ink/60 block text-sm">{t.ticketNumber}</span>
      </span>
    ),
  },
  {
    key: 'where',
    header: 'Customer and location',
    render: (t) => (
      <span>
        <span className="block">{t.customerName}</span>
        <span className="text-ink/60 block text-sm">{placeLabel(t)}</span>
      </span>
    ),
  },
  {
    key: 'priority',
    header: 'Priority',
    sortValue: (t) => PRIORITY_RANK[t.priority],
    render: (t) => <StatusBadge status={t.priority} />,
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: (t) => t.status,
    render: (t) => <StatusBadge status={t.status} />,
  },
  {
    key: 'tech',
    header: 'Technician',
    sortValue: (t) => t.assignedTechnicianName ?? '',
    render: (t) =>
      t.assignedTechnicianName ?? <span className="text-signal-ink font-semibold">Unassigned</span>,
  },
  {
    key: 'reported',
    header: 'Reported',
    align: 'right',
    sortValue: (t) => t.createdAt?.toDate?.() ?? null,
    render: (t) => formatRelative(t.createdAt),
  },
]

/** Call centre (and admin, asset manager): the live ticket queue. */
export default function TicketQueuePage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const queue = useSubscription(subscribeQueue, 'ticket-queue')
  const [view, setView] = useState('action')
  const [search, setSearch] = useState('')
  const [area, setArea] = useState<Area | 'all'>('all')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const [logging, setLogging] = useState(false)
  const term = useDebouncedValue(search, 200)
  const canLog = role === 'admin' || role === 'call_centre'

  const all = useMemo(() => queue.data ?? [], [queue.data])
  const counts = useMemo(
    () =>
      Object.fromEntries(
        VIEWS.map((v) => [
          v.id,
          all.filter((t) => !v.statuses || v.statuses.includes(t.status)).length,
        ]),
      ),
    [all],
  )
  const statuses = VIEWS.find((v) => v.id === view)?.statuses
  const rows = useMemo(
    () =>
      all.filter(
        (t) =>
          (!statuses || statuses.includes(t.status)) &&
          (area === 'all' || t.area === area) &&
          (priority === 'all' || t.priority === priority) &&
          matchesTicket(t, term),
      ),
    [all, statuses, area, priority, term],
  )

  return (
    <>
      <PageHeader
        title="Tickets"
        description="Leak, outage and fault reports. New reports appear here as they come in."
        actions={
          canLog && (
            <Button
              onClick={() => setLogging(true)}
              icon={<Plus className="size-4" aria-hidden="true" />}
            >
              Log a ticket
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Show tickets">
        {VIEWS.map((v) => (
          <Button
            key={v.id}
            size="sm"
            variant={view === v.id ? 'primary' : 'secondary'}
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
            {queue.data && (
              <span
                className={`rounded-full px-1.5 text-xs ${view === v.id ? 'bg-white/20' : 'bg-mist'}`}
              >
                {counts[v.id]}
              </span>
            )}
          </Button>
        ))}
      </div>

      <Card padded={false}>
        <div className="border-mist flex flex-col gap-3 border-b p-4 lg:flex-row">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by ticket number, customer or location"
            className="flex-1"
          />
          <label className="sr-only" htmlFor="ticket-area">
            Filter by area
          </label>
          <select
            id="ticket-area"
            value={area}
            onChange={(e) => setArea(e.target.value as Area | 'all')}
            className={`${controlClass(false)} lg:w-44`}
          >
            <option value="all">All areas</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="ticket-priority">
            Filter by priority
          </label>
          <select
            id="ticket-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority | 'all')}
            className={`${controlClass(false)} lg:w-44`}
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0] + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          caption="Tickets"
          columns={columns}
          rows={rows}
          getRowId={(t) => t.id}
          loading={queue.loading}
          error={queue.error ? friendlyError(queue.error) : null}
          onRowClick={(t) => navigate(`/staff/tickets/${t.id}`)}
          initialSort={{ key: 'reported', direction: 'desc' }}
          pageSize={15}
          emptyTitle={view === 'action' && !term ? 'Nothing needs action' : 'No matching tickets'}
          emptyDescription={
            view === 'action' && !term
              ? 'Every report has been picked up.'
              : 'Try another view or clear the filters.'
          }
        />
      </Card>

      {canLog && (
        <LogTicketModal
          open={logging}
          onClose={() => setLogging(false)}
          onCreated={(id) => navigate(`/staff/tickets/${id}`)}
        />
      )}
    </>
  )
}
