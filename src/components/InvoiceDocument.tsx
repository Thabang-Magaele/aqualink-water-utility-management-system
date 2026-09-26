import { Droplet } from 'lucide-react'
import type { Account, Invoice } from '../types/models'
import { formatCurrency, formatDate, formatKl, formatPeriod } from '../utils/format'
import StatusBadge from './StatusBadge'

interface Props {
  invoice: Invoice
  account: Account | null
  /** Shown under "Billed to" (staff view); customers see their property only. */
  customerName?: string | null
}

/** A bill as the customer would receive it. Prints cleanly on A4 (the app shell is hidden). */
export default function InvoiceDocument({ invoice, account, customerName }: Props) {
  const paid = invoice.status === 'PAID'
  return (
    <article
      className="border-mist rounded-lg border bg-white p-6 shadow-xs sm:p-8 print:border-0 print:p-0 print:shadow-none"
      aria-label={`Invoice ${invoice.invoiceNumber}`}
    >
      <header className="border-mist flex flex-wrap items-start justify-between gap-6 border-b pb-6">
        <div>
          <p className="text-reservoir flex items-center gap-2 text-lg font-bold">
            <Droplet className="size-5" aria-hidden="true" /> Silulumanzi · AquaLink
          </p>
          <p className="text-ink/60 mt-1 text-sm">Water account invoice</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold">{invoice.invoiceNumber}</p>
          <div className="mt-1">
            <StatusBadge status={invoice.status} />
          </div>
        </div>
      </header>

      <dl className="border-mist grid gap-4 border-b py-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Billing period" value={formatPeriod(invoice.billingPeriod)} />
        <Field label="Issued" value={formatDate(invoice.createdAt)} />
        <Field
          label={paid ? 'Paid on' : 'Due by'}
          value={formatDate(paid ? invoice.paidAt : invoice.dueDate)}
          strong={!paid}
        />
        <Field label="Account" value={account?.accountNumber ?? '—'} mono />
        <div className="sm:col-span-2 lg:col-span-4">
          <dt className="text-ink/60 font-semibold">Billed to</dt>
          <dd className="mt-0.5">
            {customerName && <span className="block font-semibold">{customerName}</span>}
            {account?.propertyAddress ?? 'Property not found'}
          </dd>
        </div>
      </dl>

      <div className="overflow-x-auto py-6">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Charges</caption>
          <thead className="border-mist text-ink/60 border-b">
            <tr>
              <th scope="col" className="pb-2 font-semibold">
                Description
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Used
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Rate
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="py-3 pr-4">
                Water consumption
                <span className="text-ink/60 block">
                  Meter read {formatKl(invoice.previousReading)} →{' '}
                  {formatKl(invoice.currentReading)}
                </span>
              </td>
              <td className="py-3 text-right tabular-nums">{formatKl(invoice.consumption)}</td>
              <td className="py-3 text-right tabular-nums">
                {formatCurrency(invoice.tariffRate)}/kL
              </td>
              <td className="py-3 text-right tabular-nums">{formatCurrency(invoice.amount)}</td>
            </tr>
          </tbody>
          <tfoot className="border-ink/80 border-t-2">
            <tr>
              <th scope="row" colSpan={3} className="pt-3 text-right font-bold">
                {paid ? 'Total paid' : 'Total due'}
              </th>
              <td className="pt-3 text-right text-lg font-bold tabular-nums">
                {formatCurrency(invoice.amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <footer className="border-mist text-ink/55 border-t pt-4 text-xs">
        Calculated with AquaLink’s simplified flat tariff (consumption × rate). Demonstration
        system: amounts are not real charges.
      </footer>
    </article>
  )
}

function Field({
  label,
  value,
  strong,
  mono,
}: {
  label: string
  value: string
  strong?: boolean
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-ink/60 font-semibold">{label}</dt>
      <dd className={`mt-0.5 ${strong ? 'font-bold' : ''} ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
