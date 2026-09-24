import { ArrowLeft, Gauge, Pencil, Ticket as TicketIcon, UserX, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import BalanceText from '../../../components/BalanceText'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import DataTable, { type Column } from '../../../components/DataTable'
import EmptyState from '../../../components/EmptyState'
import ErrorState from '../../../components/ErrorState'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import PageHeader from '../../../components/PageHeader'
import StatCard from '../../../components/StatCard'
import StatusBadge from '../../../components/StatusBadge'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { customerSectionsFor } from '../../../services/customerQueries'
import {
  loadCustomer,
  loadCustomerInvoices,
  loadCustomerPayments,
  loadCustomerTickets,
} from '../../../services/customerService'
import {
  TICKET_TYPE_LABELS,
  type Account,
  type Invoice,
  type Meter,
  type Payment,
  type Ticket,
} from '../../../types/models'
import { roundMoney } from '../../../utils/domain'
import { friendlyError } from '../../../utils/errors'
import { formatCurrency, formatDate, formatNumber, formatPhone } from '../../../utils/format'
import EditCustomerModal from './EditCustomerModal'

const CUSTOMERS_CRUMB = [
  { label: 'Staff console', to: '/staff' },
  { label: 'Customers', to: '/staff/customers' },
]

/** One customer: contact details, accounts and meters, plus bills, payments and tickets by role. */
export default function CustomerDetailPage() {
  const { customerId = '' } = useParams()
  const [params] = useSearchParams()
  const focusAccountId = params.get('account')
  const { role } = useAuth()
  const sections = customerSectionsFor(role)
  const [editing, setEditing] = useState(false)

  const detail = useAsync(() => loadCustomer(customerId), `customer:${customerId}`)
  const invoices = useAsync(
    sections.invoices ? () => loadCustomerInvoices(customerId) : null,
    `inv:${customerId}`,
  )
  const payments = useAsync(
    sections.payments ? () => loadCustomerPayments(customerId) : null,
    `pay:${customerId}`,
  )
  const tickets = useAsync(
    sections.tickets ? () => loadCustomerTickets(customerId) : null,
    `tkt:${customerId}`,
  )

  const customer = detail.data?.customer
  const accounts = useMemo(() => detail.data?.accounts ?? [], [detail.data])
  const accountNumbers = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.accountNumber])),
    [accounts],
  )

  // Arriving from the Accounts list: scroll to the chosen account.
  useEffect(() => {
    if (focusAccountId && customer) {
      document.getElementById(`account-${focusAccountId}`)?.scrollIntoView({ block: 'center' })
    }
  }, [focusAccountId, customer])

  if (detail.loading) {
    return (
      <>
        <PageHeader title="Customer" breadcrumbs={[...CUSTOMERS_CRUMB, { label: 'Loading…' }]} />
        <Card>
          <LoadingSkeleton lines={5} label="Loading customer…" />
        </Card>
      </>
    )
  }
  if (detail.error) {
    return (
      <>
        <PageHeader title="Customer" breadcrumbs={[...CUSTOMERS_CRUMB, { label: 'Error' }]} />
        <Card>
          <ErrorState message={friendlyError(detail.error)} onRetry={detail.reload} />
        </Card>
      </>
    )
  }
  if (!customer) {
    return (
      <>
        <PageHeader
          title="Customer not found"
          breadcrumbs={[...CUSTOMERS_CRUMB, { label: 'Not found' }]}
        />
        <Card>
          <EmptyState
            icon={UserX}
            title="This customer doesn't exist"
            description="They may have been removed, or the link is wrong."
            action={
              <Link
                to="/staff/customers"
                className="text-channel inline-flex items-center gap-1 font-semibold hover:underline"
              >
                <ArrowLeft className="size-4" aria-hidden="true" /> Back to customers
              </Link>
            }
          />
        </Card>
      </>
    )
  }

  const totalBalance = accounts.reduce((sum, a) => roundMoney(sum + a.balance), 0)
  const openTickets = tickets.data?.filter((t) => t.status !== 'RESOLVED').length

  return (
    <>
      <PageHeader
        title={customer.name}
        breadcrumbs={[...CUSTOMERS_CRUMB, { label: customer.name }]}
        description={`${customer.area} · customer since ${formatDate(customer.createdAt)}`}
        actions={
          sections.edit && (
            <Button
              variant="secondary"
              onClick={() => setEditing(true)}
              icon={<Pencil className="size-4" aria-hidden="true" />}
            >
              Edit details
            </Button>
          )
        }
      />

      <section aria-label="Summary" className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total balance"
          value={formatCurrency(totalBalance)}
          icon={Wallet}
          tone={totalBalance > 0 ? 'danger' : 'success'}
          hint={
            totalBalance > 0
              ? 'Owed across all accounts'
              : totalBalance < 0
                ? 'In credit'
                : 'Fully paid'
          }
        />
        <StatCard
          label="Accounts"
          value={accounts.length}
          icon={Gauge}
          hint={plural(detail.data?.meters.length ?? 0, 'meter')}
        />
        {sections.tickets && (
          <StatCard
            label="Open tickets"
            icon={TicketIcon}
            value={openTickets ?? '—'}
            loading={tickets.loading}
            tone={openTickets ? 'warning' : 'success'}
            hint={tickets.error ? "Couldn't load" : undefined}
          />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Contact details" padded={false}>
          <dl className="divide-mist divide-y text-sm">
            <Detail label="Email" value={customer.email || 'Not provided'} />
            <Detail
              label="Mobile"
              value={customer.phone ? formatPhone(customer.phone) : 'Not provided'}
            />
            <Detail label="Postal address" value={customer.address} />
            <Detail label="Area" value={customer.area} />
          </dl>
        </Card>

        <Card title="Accounts and meters" padded={false} className="lg:col-span-2">
          {accounts.length === 0 ? (
            <EmptyState
              title="No accounts"
              description="This customer has no property accounts yet."
            />
          ) : (
            <ul className="divide-mist divide-y">
              {accounts.map((a) => (
                <AccountItem
                  key={a.id}
                  account={a}
                  meter={detail.data?.meters.find((m) => m.id === a.meterId)}
                  highlighted={a.id === focusAccountId}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 space-y-6">
        {sections.invoices && (
          <Card title="Invoices" description="Most recent first" padded={false}>
            <DataTable
              caption="Invoices"
              columns={invoiceColumns(accountNumbers)}
              rows={invoices.data}
              getRowId={(i) => i.id}
              loading={invoices.loading}
              error={invoices.error ? friendlyError(invoices.error) : null}
              onRetry={invoices.reload}
              pageSize={6}
              emptyTitle="No invoices yet"
            />
          </Card>
        )}
        {sections.payments && (
          <Card title="Payments" padded={false}>
            <DataTable
              caption="Payments"
              columns={paymentColumns(accountNumbers)}
              rows={payments.data}
              getRowId={(p) => p.id}
              loading={payments.loading}
              error={payments.error ? friendlyError(payments.error) : null}
              onRetry={payments.reload}
              pageSize={6}
              emptyTitle="No payments yet"
            />
          </Card>
        )}
        {sections.tickets && (
          <Card
            title="Tickets"
            description="Leaks, outages and faults reported by or for this customer"
            padded={false}
          >
            <DataTable
              caption="Tickets"
              columns={ticketColumns}
              rows={tickets.data}
              getRowId={(t) => t.id}
              loading={tickets.loading}
              error={tickets.error ? friendlyError(tickets.error) : null}
              onRetry={tickets.reload}
              pageSize={6}
              emptyTitle="No tickets"
              emptyDescription="Nothing has been reported for this customer."
            />
          </Card>
        )}
      </div>

      {sections.edit && (
        <EditCustomerModal
          customer={customer}
          open={editing}
          onClose={() => setEditing(false)}
          onSaved={detail.reload}
        />
      )}
    </>
  )
}

/** "1 meter", "2 meters" */
function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3">
      <dt className="text-ink/60 font-semibold">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  )
}

function AccountItem({
  account,
  meter,
  highlighted,
}: {
  account: Account
  meter?: Meter
  highlighted: boolean
}) {
  return (
    <li
      id={`account-${account.id}`}
      aria-current={highlighted || undefined}
      className={`px-5 py-4 ${highlighted ? 'bg-channel/5 ring-channel ring-2 ring-inset' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono font-semibold">{account.accountNumber}</p>
          <p className="text-ink/70 text-sm">{account.propertyAddress}</p>
        </div>
        <div className="text-right">
          <BalanceText amount={account.balance} />
          <div className="mt-1">
            <StatusBadge status={account.status} />
          </div>
        </div>
      </div>
      <p className="text-ink/70 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Gauge className="text-ink/50 size-4" aria-hidden="true" />
        {meter ? (
          <>
            <span className="font-mono">{meter.meterNumber}</span>
            <StatusBadge status={meter.status} />
            <span>
              Last reading {formatNumber(meter.lastReading)} kL
              {meter.lastReadingDate && ` on ${formatDate(meter.lastReadingDate)}`}
            </span>
          </>
        ) : (
          <span>No meter installed</span>
        )}
      </p>
    </li>
  )
}

const invoiceColumns = (accounts: Map<string, string>): Column<Invoice>[] => [
  {
    key: 'number',
    header: 'Invoice',
    render: (i) => <span className="font-semibold">{i.invoiceNumber}</span>,
  },
  {
    key: 'account',
    header: 'Account',
    hideOnMobile: true,
    render: (i) => <span className="font-mono">{accounts.get(i.accountId) ?? '—'}</span>,
  },
  {
    key: 'period',
    header: 'Period',
    sortValue: (i) => i.billingPeriod,
    render: (i) => i.billingPeriod,
  },
  {
    key: 'use',
    header: 'Used',
    align: 'right',
    hideOnMobile: true,
    render: (i) => `${formatNumber(i.consumption)} kL`,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    sortValue: (i) => i.amount,
    render: (i) => formatCurrency(i.amount),
  },
  {
    key: 'due',
    header: 'Due',
    sortValue: (i) => i.dueDate.toDate(),
    render: (i) => formatDate(i.dueDate),
  },
  { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
]

const paymentColumns = (accounts: Map<string, string>): Column<Payment>[] => [
  { key: 'date', header: 'Date', render: (p) => formatDate(p.paidAt ?? p.createdAt) },
  {
    key: 'reference',
    header: 'Reference',
    render: (p) => <span className="font-mono">{p.reference}</span>,
  },
  {
    key: 'account',
    header: 'Account',
    hideOnMobile: true,
    render: (p) => <span className="font-mono">{accounts.get(p.accountId) ?? '—'}</span>,
  },
  {
    key: 'method',
    header: 'Method',
    hideOnMobile: true,
    render: (p) => p.paymentMethod[0] + p.paymentMethod.slice(1).toLowerCase(),
  },
  { key: 'amount', header: 'Amount', align: 'right', render: (p) => formatCurrency(p.amount) },
  { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
]

const ticketColumns: Column<Ticket>[] = [
  {
    key: 'number',
    header: 'Ticket',
    render: (t) => <span className="font-semibold">{t.ticketNumber}</span>,
  },
  { key: 'type', header: 'Issue', render: (t) => TICKET_TYPE_LABELS[t.type] ?? t.type },
  { key: 'location', header: 'Location', hideOnMobile: true, render: (t) => t.location },
  { key: 'priority', header: 'Priority', render: (t) => <StatusBadge status={t.priority} /> },
  { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
  { key: 'reported', header: 'Reported', align: 'right', render: (t) => formatDate(t.createdAt) },
]
