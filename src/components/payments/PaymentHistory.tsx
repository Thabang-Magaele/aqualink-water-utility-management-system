import DataTable, { type Column } from '../DataTable'
import StatusBadge from '../StatusBadge'
import type { Payment } from '../../types/models'
import { formatCurrency, formatDateTime } from '../../utils/format'

const METHOD: Record<string, string> = { CARD: 'Card', EFT: 'EFT', CASH: 'Cash' }

function describe(p: Payment): string {
  if (p.paymentMethod === 'CARD' && p.cardLast4)
    return `${p.cardBrand ?? 'Card'} •••• ${p.cardLast4}`
  return METHOD[p.paymentMethod] ?? p.paymentMethod
}

/** Payments list shared by the invoice page and the customer's Bills page. */
export default function PaymentHistory({
  payments,
  caption,
}: {
  payments: Payment[]
  caption: string
}) {
  const columns: Column<Payment>[] = [
    { key: 'date', header: 'Date', render: (p) => formatDateTime(p.paidAt ?? p.createdAt) },
    { key: 'method', header: 'Method', render: describe },
    {
      key: 'reference',
      header: 'Reference',
      hideOnMobile: true,
      render: (p) =>
        p.reference ? (
          <span className="font-mono">{p.reference}</span>
        ) : (
          <span className="text-ink/50">—</span>
        ),
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => formatCurrency(p.amount) },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <span>
          <StatusBadge status={p.status} />
          {p.status === 'FAILED' && p.failureReason && (
            <span className="text-ink/60 mt-0.5 block text-xs">{p.failureReason}</span>
          )}
        </span>
      ),
    },
  ]
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={payments}
      getRowId={(p) => p.id}
      pageSize={6}
      emptyTitle="No payments yet"
    />
  )
}
