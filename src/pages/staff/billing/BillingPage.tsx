import { CalendarClock, CircleDollarSign, Receipt, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import DataTable, { type Column } from '../../../components/DataTable'
import PageHeader from '../../../components/PageHeader'
import SearchBar from '../../../components/SearchBar'
import StatCard from '../../../components/StatCard'
import StatusBadge from '../../../components/StatusBadge'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import {
  loadBillingSettings,
  loadInvoiceList,
  type InvoiceRow,
} from '../../../services/billingService'
import type { InvoiceStatus } from '../../../types/models'
import { normalise } from '../../../utils/customerSearch'
import { roundMoney } from '../../../utils/domain'
import { friendlyError } from '../../../utils/errors'
import { formatCurrency, formatDate, formatPeriod } from '../../../utils/format'
import RunBillingModal from './RunBillingModal'
import TariffCard from './TariffCard'

type Tab = 'ALL' | InvoiceStatus
const TABS: { id: Tab; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'UNPAID', label: 'Unpaid' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'PAID', label: 'Paid' },
]

const columns: Column<InvoiceRow>[] = [
  {
    key: 'number',
    header: 'Invoice',
    sortValue: (r) => r.invoice.invoiceNumber,
    render: (r) => <span className="font-mono font-semibold">{r.invoice.invoiceNumber}</span>,
  },
  {
    key: 'customer',
    header: 'Customer',
    sortValue: (r) => r.customerName,
    render: (r) => (
      <span>
        <span className="block">{r.customerName}</span>
        <span className="text-ink/60 block font-mono text-sm">{r.accountNumber}</span>
      </span>
    ),
  },
  {
    key: 'period',
    header: 'Period',
    hideOnMobile: true,
    sortValue: (r) => r.invoice.billingPeriod,
    render: (r) => formatPeriod(r.invoice.billingPeriod),
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    sortValue: (r) => r.invoice.amount,
    render: (r) => formatCurrency(r.invoice.amount),
  },
  {
    key: 'due',
    header: 'Due',
    sortValue: (r) => r.invoice.dueDate.toDate(),
    render: (r) => formatDate(r.invoice.dueDate),
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: (r) => r.invoice.status,
    render: (r) => <StatusBadge status={r.invoice.status} />,
  },
]

const sum = (rows: InvoiceRow[]) =>
  rows.reduce((total, r) => roundMoney(total + r.invoice.amount), 0)

/** Billing overview: what's owed, the tariff, a billing run, and every invoice. */
export default function BillingPage() {
  const navigate = useNavigate()
  const invoices = useAsync(loadInvoiceList, 'invoice-list')
  const settings = useAsync(loadBillingSettings, 'billing-settings')
  const [running, setRunning] = useState(false)
  const [tab, setTab] = useState<Tab>('ALL')
  const [search, setSearch] = useState('')
  const term = normalise(useDebouncedValue(search, 200))

  const all = useMemo(() => invoices.data ?? [], [invoices.data])
  const outstanding = all.filter((r) => r.invoice.status !== 'PAID')
  const overdue = all.filter((r) => r.invoice.status === 'OVERDUE')
  const now = new Date()
  const thisMonth = all.filter((r) => {
    const d = r.invoice.createdAt?.toDate()
    return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const counts = Object.fromEntries(
    TABS.map((t) => [
      t.id,
      t.id === 'ALL' ? all.length : all.filter((r) => r.invoice.status === t.id).length,
    ]),
  )

  const filtered = useMemo(
    () =>
      all.filter(
        (r) =>
          (tab === 'ALL' || r.invoice.status === tab) &&
          (!term ||
            normalise(r.invoice.invoiceNumber).includes(term) ||
            r.accountNumber.includes(term) ||
            normalise(r.customerName).includes(term)),
      ),
    [all, tab, term],
  )

  return (
    <>
      <PageHeader
        title="Billing"
        description="Invoices are calculated from meter readings: water used × tariff."
        actions={
          <Button
            onClick={() => setRunning(true)}
            icon={<Receipt className="size-4" aria-hidden="true" />}
          >
            Run billing
          </Button>
        }
      />

      <section aria-label="Summary" className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={formatCurrency(sum(outstanding))}
          icon={CircleDollarSign}
          tone="warning"
          loading={invoices.loading}
          hint={`${outstanding.length} unpaid or overdue`}
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(sum(overdue))}
          icon={TriangleAlert}
          tone={overdue.length ? 'danger' : 'success'}
          loading={invoices.loading}
          hint={
            overdue.length
              ? `${overdue.length} invoice${overdue.length === 1 ? '' : 's'} past due`
              : 'Nothing overdue'
          }
        />
        <StatCard
          label="Invoiced this month"
          value={formatCurrency(sum(thisMonth))}
          icon={CalendarClock}
          loading={invoices.loading}
          hint={`${thisMonth.length} invoices`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card title="Invoices" padded={false} className="lg:col-span-3">
          <div className="border-mist flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Show invoices">
              {TABS.map((t) => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={tab === t.id ? 'primary' : 'secondary'}
                  aria-pressed={tab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}{' '}
                  <span className="rounded bg-black/10 px-1.5 text-xs">
                    {invoices.data ? counts[t.id] : '…'}
                  </span>
                </Button>
              ))}
            </div>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by invoice, account or customer"
              className="flex-1"
            />
          </div>
          <DataTable
            caption="Invoices"
            columns={columns}
            rows={filtered}
            getRowId={(r) => r.invoice.id}
            loading={invoices.loading}
            error={invoices.error ? friendlyError(invoices.error) : null}
            onRetry={invoices.reload}
            onRowClick={(r) => navigate(`/staff/billing/invoices/${r.invoice.id}`)}
            pageSize={15}
            emptyTitle={term || tab !== 'ALL' ? 'No matching invoices' : 'No invoices yet'}
            emptyDescription={
              term || tab !== 'ALL'
                ? 'Try another tab or search.'
                : 'Use “Run billing” once meters have been read.'
            }
          />
        </Card>
        <div className="space-y-6">
          <TariffCard
            settings={settings.data}
            loading={settings.loading}
            error={settings.error ? friendlyError(settings.error) : null}
            onChanged={settings.reload}
          />
          <Card title="Overdue invoices">
            <p className="text-ink/70 text-sm">
              Unpaid invoices are marked overdue automatically every night at 01:00, and the
              customer is notified.
            </p>
          </Card>
        </div>
      </div>

      <RunBillingModal open={running} onClose={() => setRunning(false)} onDone={invoices.reload} />
    </>
  )
}
