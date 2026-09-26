import { ArrowLeft, Printer, ReceiptText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import EmptyState from '../../../components/EmptyState'
import ErrorState from '../../../components/ErrorState'
import InvoiceDocument from '../../../components/InvoiceDocument'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import PageHeader from '../../../components/PageHeader'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { canOpen } from '../../../routes/navigation'
import { loadInvoice } from '../../../services/billingService'
import { friendlyError } from '../../../utils/errors'

interface Props {
  /** Staff see the customer and link to their page; customers see their own bill. */
  audience: 'staff' | 'customer'
}

/** One invoice as a printable bill (/staff/billing/invoices/:id and /customer/bills/:id). */
export default function InvoicePage({ audience }: Props) {
  const { invoiceId = '' } = useParams()
  const { role } = useAuth()
  const detail = useAsync(
    () => loadInvoice(invoiceId, { withCustomer: audience === 'staff' }),
    `invoice:${invoiceId}`,
  )
  const crumbs =
    audience === 'staff'
      ? [
          { label: 'Staff console', to: '/staff' },
          { label: 'Billing', to: '/staff/billing' },
        ]
      : [
          { label: 'My AquaLink', to: '/customer' },
          { label: 'Bills', to: '/customer/bills' },
        ]
  const backTo = audience === 'staff' ? '/staff/billing' : '/customer/bills'
  const data = detail.data

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={data ? `Invoice ${data.invoice.invoiceNumber}` : 'Invoice'}
          breadcrumbs={[
            ...crumbs,
            { label: data?.invoice.invoiceNumber ?? (detail.loading ? 'Loading…' : 'Invoice') },
          ]}
          actions={
            data && (
              <Button
                variant="secondary"
                onClick={() => window.print()}
                icon={<Printer className="size-4" aria-hidden="true" />}
              >
                Print or save as PDF
              </Button>
            )
          }
          description={
            data?.customer && canOpen(role, `/staff/customers/${data.customer.id}`) ? (
              <Link
                className="text-channel font-semibold hover:underline"
                to={`/staff/customers/${data.customer.id}?account=${data.invoice.accountId}`}
              >
                Open {data.customer.name}’s customer page
              </Link>
            ) : undefined
          }
        />
      </div>

      {detail.loading && (
        <Card>
          <LoadingSkeleton lines={6} label="Loading invoice…" />
        </Card>
      )}
      {detail.error && (
        <Card>
          <ErrorState message={friendlyError(detail.error)} onRetry={detail.reload} />
        </Card>
      )}
      {!detail.loading && !detail.error && !data && (
        <Card>
          <EmptyState
            icon={ReceiptText}
            title="This invoice doesn't exist"
            action={
              <Link
                to={backTo}
                className="text-channel inline-flex items-center gap-1 font-semibold hover:underline"
              >
                <ArrowLeft className="size-4" aria-hidden="true" /> Back
              </Link>
            }
          />
        </Card>
      )}
      {data && (
        <InvoiceDocument
          invoice={data.invoice}
          account={data.account}
          customerName={data.customer?.name}
        />
      )}
    </>
  )
}
