import { CalendarClock, CircleDollarSign, ReceiptText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Alert from '../../components/Alert'
import Card from '../../components/Card'
import DataTable, { type Column } from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { loadMyBills } from '../../services/billingService'
import type { Invoice } from '../../types/models'
import { roundMoney } from '../../utils/domain'
import { friendlyError } from '../../utils/errors'
import { formatCurrency, formatDate, formatPeriod } from '../../utils/format'

/** The customer's invoices across all their properties. */
export default function BillsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid ?? ''
  const bills = useAsync(uid ? () => loadMyBills(uid) : null, `bills:${uid}`)
  const invoices = bills.data?.invoices ?? []
  const address = new Map((bills.data?.accounts ?? []).map((a) => [a.id, a.propertyAddress]))

  const open = invoices.filter((i) => i.status !== 'PAID')
  const overdue = invoices.filter((i) => i.status === 'OVERDUE')
  const due = open.reduce((sum, i) => roundMoney(sum + i.amount), 0)
  // The next upcoming payment: overdue invoices have their own warning above.
  const next = open
    .filter((i) => i.status === 'UNPAID')
    .sort((a, b) => a.dueDate.toMillis() - b.dueDate.toMillis())[0]

  const columns: Column<Invoice>[] = [
    {
      key: 'period',
      header: 'Period',
      sortValue: (i) => i.billingPeriod,
      render: (i) => <span className="font-semibold">{formatPeriod(i.billingPeriod)}</span>,
    },
    {
      key: 'property',
      header: 'Property',
      hideOnMobile: true,
      render: (i) => address.get(i.accountId) ?? '—',
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

  return (
    <>
      <PageHeader
        title="Bills"
        description="Your water invoices. Open one to see how it was calculated."
      />
      {overdue.length > 0 && (
        <div className="mb-6">
          <Alert
            tone="error"
            title={`${overdue.length} invoice${overdue.length === 1 ? ' is' : 's are'} overdue`}
          >
            Please pay it as soon as possible, or contact Silulumanzi if you need help.
          </Alert>
        </div>
      )}
      <section aria-label="Summary" className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Amount due"
          value={formatCurrency(due)}
          icon={CircleDollarSign}
          tone={due > 0 ? 'warning' : 'success'}
          loading={bills.loading}
          hint={
            due > 0
              ? `${open.length} unpaid invoice${open.length === 1 ? '' : 's'}`
              : 'You’re all paid up'
          }
        />
        <StatCard
          label="Next due date"
          value={next ? formatDate(next.dueDate) : '—'}
          icon={CalendarClock}
          loading={bills.loading}
          hint={
            next
              ? `${formatCurrency(next.amount)} for ${formatPeriod(next.billingPeriod)}`
              : overdue.length
                ? 'Only overdue invoices remain'
                : 'Nothing due'
          }
        />
      </section>
      <Card title="Invoices" padded={false}>
        <DataTable
          caption="Your invoices"
          columns={columns}
          rows={invoices}
          getRowId={(i) => i.id}
          loading={bills.loading}
          error={bills.error ? friendlyError(bills.error) : null}
          onRetry={bills.reload}
          onRowClick={(i) => navigate(`/customer/bills/${i.id}`)}
          pageSize={12}
          emptyTitle="No bills yet"
          emptyDescription="Your first invoice appears after your meter has been read."
        />
      </Card>
      <p className="text-ink/60 mt-4 flex items-center gap-2 text-sm">
        <ReceiptText className="size-4" aria-hidden="true" /> Online payment is coming soon.
      </p>
    </>
  )
}
