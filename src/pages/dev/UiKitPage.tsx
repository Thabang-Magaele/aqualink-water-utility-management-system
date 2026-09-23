import { CircleDollarSign, Droplets, Plus, Ticket, TriangleAlert, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Card from '../../components/Card'
import ConfirmDialog from '../../components/ConfirmDialog'
import DataTable, { type Column } from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import { FormInput, FormSelect, FormTextarea } from '../../components/FormField'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import SearchBar from '../../components/SearchBar'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate } from '../../utils/format'
import { STATUS_STYLES } from '../../utils/status'

/** Fictional sample data for the table demo. */
interface SampleTicket {
  id: string
  number: string
  customer: string
  type: string
  status: string
  priority: string
  created: Date
}
const AREAS = ['KaNyamazane', 'Matsulu', 'White River', 'Nelspruit CBD', 'Tekwane', 'Msogwaba']
const NAMES = [
  'Thandi Mokoena',
  'Sipho Dlamini',
  'Anele Khumalo',
  'Pieter van Wyk',
  'Lindiwe Nkosi',
  'Kagiso Molefe',
  'Zanele Mthembu',
  'Johan Botha',
  'Nomvula Sithole',
  'Themba Ndlovu',
  'Ayanda Zulu',
  'Refilwe Mahlangu',
]
const SAMPLE: SampleTicket[] = NAMES.map((name, i) => ({
  id: `t${i}`,
  number: `TKT-${String(1041 + i).padStart(5, '0')}`,
  customer: name,
  type: i % 3 === 0 ? `No water, ${AREAS[i % AREAS.length]}` : `Leak, ${AREAS[i % AREAS.length]}`,
  status: ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED'][i % 4],
  priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][i % 4],
  created: new Date(2026, 8, 22 - i),
}))

const columns: Column<SampleTicket>[] = [
  {
    key: 'number',
    header: 'Ticket',
    sortValue: (t) => t.number,
    render: (t) => <span className="font-semibold">{t.number}</span>,
  },
  { key: 'customer', header: 'Customer', sortValue: (t) => t.customer, render: (t) => t.customer },
  { key: 'type', header: 'Issue', render: (t) => t.type, hideOnMobile: true },
  {
    key: 'priority',
    header: 'Priority',
    sortValue: (t) => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(t.priority),
    render: (t) => <StatusBadge status={t.priority} />,
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: (t) => t.status,
    render: (t) => <StatusBadge status={t.status} />,
  },
  {
    key: 'created',
    header: 'Reported',
    sortValue: (t) => t.created,
    render: (t) => formatDate(t.created),
    align: 'right',
  },
]

/**
 * Development-only catalogue of the AquaLink UI system (/ui-kit).
 * Check here before building a new component: it probably exists.
 */
export default function UiKitPage() {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tableState, setTableState] = useState<'data' | 'loading' | 'empty' | 'error'>('data')
  const term = useDebouncedValue(search).trim().toLowerCase()
  const rows = useMemo(
    () =>
      SAMPLE.filter(
        (t) =>
          !term || t.customer.toLowerCase().includes(term) || t.number.toLowerCase().includes(term),
      ),
    [term],
  )

  return (
    <>
      <PageHeader
        title="UI kit"
        description="Every shared component in one place. Visible in development only."
        actions={
          <Button icon={<Plus className="size-4" aria-hidden="true" />}>Primary action</Button>
        }
      />

      <div className="space-y-8">
        <Card title="Stat cards">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total customers"
              value="1,284"
              icon={Users}
              hint="12 joined this week"
            />
            <StatCard
              label="Open tickets"
              value={37}
              icon={Ticket}
              tone="warning"
              hint="8 escalated"
            />
            <StatCard
              label="Unpaid invoices"
              value={formatCurrency(48215.5)}
              icon={CircleDollarSign}
              tone="danger"
            />
            <StatCard
              label="Water quality"
              value="All normal"
              icon={Droplets}
              tone="success"
              loading={tableState === 'loading'}
            />
          </div>
        </Card>

        <Card title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Delete asset</Button>
            <Button variant="ghost">Ghost</Button>
            <Button loading>Saving…</Button>
            <Button size="sm">Small</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>

        <Card
          title="Status badges"
          description="Colours come from utils/status.ts; the label is always shown."
        >
          <div className="flex flex-wrap gap-2">
            {Object.keys(STATUS_STYLES).map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </Card>

        <Card
          title="Data table"
          description="Sortable columns, search, pagination, and cards on mobile. Switch states to preview them."
          padded={false}
          actions={
            <div className="flex flex-wrap gap-1" role="group" aria-label="Table state">
              {(['data', 'loading', 'empty', 'error'] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={tableState === s ? 'primary' : 'secondary'}
                  onClick={() => setTableState(s)}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          }
        >
          <div className="border-mist border-b p-4">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search tickets by customer or number"
            />
          </div>
          <DataTable
            caption="Sample tickets"
            columns={columns}
            rows={tableState === 'empty' ? [] : rows}
            getRowId={(t) => t.id}
            loading={tableState === 'loading'}
            error={
              tableState === 'error'
                ? 'AquaLink could not reach the server. Check your connection and try again.'
                : null
            }
            onRetry={() => setTableState('data')}
            onRowClick={(t) =>
              toast({ tone: 'info', title: t.number, message: `Row clicked: ${t.customer}` })
            }
            initialSort={{ key: 'created', direction: 'desc' }}
            pageSize={5}
            emptyTitle="No tickets"
            emptyDescription="Leak and outage reports will appear here."
          />
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card title="Form fields">
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <FormInput
                label="Account number"
                placeholder="e.g. 4100 2231 07"
                hint="Printed at the top of your bill."
                required
              />
              <FormInput
                label="Email address"
                type="email"
                defaultValue="not-an-email"
                error="Enter a valid email address."
              />
              <FormSelect label="Issue type" defaultValue="LEAK">
                <option value="LEAK">Leak</option>
                <option value="NO_WATER">No water</option>
                <option value="LOW_PRESSURE">Low pressure</option>
              </FormSelect>
              <FormTextarea
                label="Description"
                placeholder="Where is the leak and how bad is it?"
              />
            </form>
          </Card>

          <Card title="Alerts, dialogs and toasts">
            <div className="space-y-3">
              <Alert tone="info">Scheduled maintenance on Saturday, 06:00 to 10:00.</Alert>
              <Alert tone="success">Payment received. Thank you.</Alert>
              <Alert tone="warning" title="Invoice overdue">
                Pay by 30 September to avoid a late fee.
              </Alert>
              <Alert tone="error">We couldn't save your changes.</Alert>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(true)}>
                Open modal
              </Button>
              <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
                Confirm dialog
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast({ title: 'Ticket assigned', message: 'TKT-01041 sent to Bongani Dube.' })
                }
              >
                Success toast
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast({
                    tone: 'error',
                    title: 'Payment failed',
                    message: 'Your card was declined.',
                  })
                }
              >
                Error toast
              </Button>
            </div>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <Card title="Empty state">
            <EmptyState
              icon={TriangleAlert}
              title="No active outages"
              description="Planned and unplanned outages will show here."
            />
          </Card>
          <Card title="Error state">
            <ErrorState
              message="Something went wrong loading readings."
              onRetry={() => toast({ title: 'Retrying…', tone: 'info' })}
            />
          </Card>
          <Card title="Loading skeleton">
            <LoadingSkeleton lines={4} />
          </Card>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Report a leak"
        description="Tell us where the problem is. A technician will be assigned."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false)
                toast({ title: 'Report submitted', message: 'Ticket TKT-01053 created.' })
              }}
            >
              Submit report
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput label="Street address" placeholder="12 Mahlangu Street, KaNyamazane" />
          <FormTextarea label="What do you see?" rows={3} />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Resolve this ticket?"
        message="The customer will be notified that the leak has been fixed."
        confirmLabel="Mark as resolved"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          toast({ title: 'Ticket resolved' })
        }}
      />
    </>
  )
}
