import { ArrowLeft, Banknote, CreditCard, Printer, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import EmptyState from '../../../components/EmptyState'
import ErrorState from '../../../components/ErrorState'
import InvoiceDocument from '../../../components/InvoiceDocument'
import PaymentHistory from '../../../components/payments/PaymentHistory'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import PageHeader from '../../../components/PageHeader'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { canOpen } from '../../../routes/navigation'
import { loadInvoice } from '../../../services/billingService'
import { friendlyError } from '../../../utils/errors'
import RecordPaymentModal from './RecordPaymentModal'

interface Props {
  /** Staff see the customer and link to their page; customers see their own bill. */
  audience: 'staff' | 'customer'
}

/** One invoice as a printable bill (/staff/billing/invoices/:id and /customer/bills/:id). */
export default function InvoicePage({ audience }: Props) {
  const { invoiceId = '' } = useParams()
  const { role } = useAuth()
  const [recording, setRecording] = useState(false)
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
  const payable = data?.invoice.status === 'UNPAID' || data?.invoice.status === 'OVERDUE'

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
              <>
                {payable && audience === 'customer' && (
                  <Link
                    to={`/customer/bills/${data.invoice.id}/pay`}
                    className="bg-reservoir hover:bg-reservoir-deep inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-semibold text-white"
                  >
                    <CreditCard className="size-4" aria-hidden="true" /> Pay now
                  </Link>
                )}
                {payable && audience === 'staff' && (role === 'billing' || role === 'admin') && (
                  <Button
                    onClick={() => setRecording(true)}
                    icon={<Banknote className="size-4" aria-hidden="true" />}
                  >
                    Record payment
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => window.print()}
                  icon={<Printer className="size-4" aria-hidden="true" />}
                >
                  Print or save as PDF
                </Button>
              </>
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
      {data && (
        <div className="mt-6 print:hidden">
          <Card title="Payments" padded={false}>
            <PaymentHistory payments={data.payments} caption="Payments for this invoice" />
          </Card>
        </div>
      )}
      {data && payable && audience === 'staff' && (
        <RecordPaymentModal
          invoice={data.invoice}
          open={recording}
          onClose={() => setRecording(false)}
          onRecorded={detail.reload}
        />
      )}
    </>
  )
}
