import { ArrowLeft, CircleCheck, CreditCard, LockKeyhole, Printer } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import { FormInput } from '../../components/FormField'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import { useAsync } from '../../hooks/useAsync'
import { loadInvoice } from '../../services/billingService'
import { newAttemptKey, payByCard, type PaymentOutcome } from '../../services/paymentService'
import {
  cardFormErrors,
  formatCardNumber,
  formatExpiry,
  TEST_CARDS,
  type CardForm,
} from '../../utils/card'
import { friendlyError } from '../../utils/errors'
import { formatCurrency, formatDate, formatDateTime, formatPeriod } from '../../utils/format'

const CRUMBS = [
  { label: 'My AquaLink', to: '/customer' },
  { label: 'Bills', to: '/customer/bills' },
]

/** Pay one invoice by card (sandbox: no real money moves). */
export default function PayInvoicePage() {
  const { invoiceId = '' } = useParams()
  const detail = useAsync(() => loadInvoice(invoiceId, { withCustomer: false }), `pay:${invoiceId}`)
  const [card, setCard] = useState<CardForm>({ name: '', number: '', expiry: '', cvc: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof CardForm, string>>>({})
  const [attemptKey, setAttemptKey] = useState(newAttemptKey)
  const [paying, setPaying] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<PaymentOutcome | null>(null)

  const invoice = detail.data?.invoice
  const title = invoice ? `Pay ${invoice.invoiceNumber}` : 'Pay invoice'
  const header = <PageHeader title={title} breadcrumbs={[...CRUMBS, { label: 'Pay' }]} />

  if (detail.loading)
    return (
      <>
        {header}
        <Card>
          <LoadingSkeleton lines={5} label="Loading invoice…" />
        </Card>
      </>
    )
  if (detail.error)
    return (
      <>
        {header}
        <Card>
          <ErrorState message={friendlyError(detail.error)} onRetry={detail.reload} />
        </Card>
      </>
    )
  if (!invoice)
    return (
      <>
        {header}
        <Card>
          <EmptyState title="This invoice doesn't exist" action={<BackToBills />} />
        </Card>
      </>
    )

  if (receipt) return <Receipt outcome={receipt} />

  if (invoice.status === 'PAID')
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={CircleCheck}
            title="This invoice is already paid"
            description={invoice.paidAt ? `Paid on ${formatDate(invoice.paidAt)}.` : undefined}
            action={<BackToBills />}
          />
        </Card>
      </>
    )

  const set =
    (field: keyof CardForm, format?: (v: string) => string) => (e: { target: { value: string } }) =>
      setCard((c) => ({ ...c, [field]: format ? format(e.target.value) : e.target.value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (paying) return
    const found = cardFormErrors(card)
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length) return
    setPaying(true)
    try {
      const outcome = await payByCard(invoiceId, card, attemptKey)
      if (outcome.status === 'SUCCESS') {
        setReceipt(outcome)
      } else {
        setFailure(outcome.message)
        setAttemptKey(newAttemptKey()) // a fresh attempt for the next try
      }
    } catch (error) {
      // Network failure: keep the same key, so pressing Pay again can't charge twice
      setFailure(error instanceof Error ? error.message : friendlyError(error))
    } finally {
      setPaying(false)
    }
  }

  return (
    <>
      {header}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card
            title="Card details"
            description="Paid in full. The invoice is marked paid straight away."
          >
            <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={paying}>
              {failure && (
                <Alert tone="error" title="Payment didn’t go through">
                  {failure}
                </Alert>
              )}
              <FormInput
                label="Name on card"
                autoComplete="cc-name"
                value={card.name}
                onChange={set('name')}
                error={errors.name}
                required
                disabled={paying}
              />
              <FormInput
                label="Card number"
                autoComplete="cc-number"
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                value={card.number}
                onChange={set('number', formatCardNumber)}
                error={errors.number}
                required
                disabled={paying}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Expiry (MM/YY)"
                  autoComplete="cc-exp"
                  inputMode="numeric"
                  placeholder="MM/YY"
                  value={card.expiry}
                  onChange={set('expiry', formatExpiry)}
                  error={errors.expiry}
                  required
                  disabled={paying}
                />
                <FormInput
                  label="Security code"
                  autoComplete="cc-csc"
                  inputMode="numeric"
                  placeholder="123"
                  maxLength={4}
                  value={card.cvc}
                  onChange={set('cvc', (v) => v.replace(/\D/g, ''))}
                  error={errors.cvc}
                  required
                  disabled={paying}
                />
              </div>
              <Button
                type="submit"
                loading={paying}
                className="w-full"
                icon={<LockKeyhole className="size-4" aria-hidden="true" />}
              >
                {paying ? 'Processing payment…' : `Pay ${formatCurrency(invoice.amount)}`}
              </Button>
              <p className="text-ink/60 text-center text-xs">
                Card details are sent securely and never stored. Only the last four digits appear on
                your receipt.
              </p>
            </form>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title="You’re paying">
            <dl className="space-y-2 text-sm">
              <Row label="Invoice" value={invoice.invoiceNumber} />
              <Row label="Period" value={formatPeriod(invoice.billingPeriod)} />
              <Row label="Due" value={formatDate(invoice.dueDate)} />
              <div className="flex items-center justify-between">
                <dt className="text-ink/60">Status</dt>
                <dd>
                  <StatusBadge status={invoice.status} />
                </dd>
              </div>
            </dl>
            <p className="border-mist mt-4 flex items-baseline justify-between border-t pt-4">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold tabular-nums">
                {formatCurrency(invoice.amount)}
              </span>
            </p>
          </Card>
          <Card
            title="Demonstration payments"
            description="No real money moves. Use one of these test cards with any name, a future expiry date and any 3 digits."
          >
            <ul className="space-y-2 text-sm">
              {TEST_CARDS.map((t) => (
                <li key={t.number} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-mono">{t.number}</span>
                    <span className="text-ink/60 block">{t.outcome}</span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={paying}
                    onClick={() => setCard((c) => ({ ...c, number: t.number }))}
                    aria-label={`Use test card ending ${t.number.slice(-4)}`}
                  >
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/60">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function BackToBills() {
  return (
    <Link
      to="/customer/bills"
      className="text-channel inline-flex items-center gap-1 font-semibold hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> Back to bills
    </Link>
  )
}

function Receipt({ outcome }: { outcome: PaymentOutcome }) {
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Payment received" breadcrumbs={[...CRUMBS, { label: 'Receipt' }]} />
      </div>
      <Card className="mx-auto max-w-lg">
        <div className="flex flex-col items-center text-center">
          <span className="bg-clear/10 text-clear rounded-full p-3">
            <CircleCheck className="size-8" aria-hidden="true" />
          </span>
          <p className="mt-3 text-2xl font-bold tabular-nums">{formatCurrency(outcome.amount)}</p>
          <p className="text-ink/70 mt-1">Thank you. Your payment was successful.</p>
        </div>
        <dl className="border-mist mt-6 space-y-2 border-t pt-4 text-sm">
          <Row label="Invoice" value={outcome.invoiceNumber} />
          <Row label="Reference" value={outcome.reference ?? '—'} />
          <Row label="Date" value={formatDateTime(new Date())} />
          <Row label="Status" value="Paid" />
        </dl>
        <div className="mt-6 flex flex-wrap justify-center gap-2 print:hidden">
          <Button
            variant="secondary"
            onClick={() => window.print()}
            icon={<Printer className="size-4" aria-hidden="true" />}
          >
            Print receipt
          </Button>
          <Link
            to={`/customer/bills/${outcome.invoiceId}`}
            className="bg-reservoir hover:bg-reservoir-deep inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-semibold text-white"
          >
            <CreditCard className="size-4" aria-hidden="true" /> View invoice
          </Link>
        </div>
      </Card>
    </>
  )
}
