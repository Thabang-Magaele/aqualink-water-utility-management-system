import { useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../../../components/Alert'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import { useToast } from '../../../hooks/useToast'
import { generateInvoice, type BillingPreview } from '../../../services/billingService'
import { formatCurrency, formatDate, formatKl, formatPeriod } from '../../../utils/format'

/**
 * Billing for this meter's account: preview the invoice for its use since the last
 * invoice, then create it. Reset (via `key`) whenever a new reading is recorded.
 */
export default function GenerateInvoiceCard({ accountId }: { accountId: string }) {
  const { toast } = useToast()
  const [preview, setPreview] = useState<BillingPreview | null>(null)
  const [created, setCreated] = useState<BillingPreview | null>(null)
  const [busy, setBusy] = useState<'preview' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(dryRun: boolean) {
    setBusy(dryRun ? 'preview' : 'create')
    setError(null)
    try {
      const result = await generateInvoice(accountId, dryRun)
      if (dryRun) setPreview(result)
      else if (result.ok) {
        setCreated(result)
        setPreview(null)
        toast({
          title: 'Invoice created',
          message: `${result.invoiceNumber} for ${formatCurrency(result.amount)}. The customer has been notified.`,
        })
      } else setPreview(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card title="Invoice" description="Bill this account for water used since its last invoice">
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {created?.ok && (
          <Alert tone="success" title={`${created.invoiceNumber} created`}>
            {formatCurrency(created.amount)}, due {formatDate(new Date(created.dueDate))}.{' '}
            <Link
              className="font-semibold underline"
              to={`/staff/billing/invoices/${created.invoiceId}`}
            >
              View invoice
            </Link>
          </Alert>
        )}
        {preview && !preview.ok && <Alert tone="info">{preview.message}</Alert>}
        {preview?.ok && (
          <dl className="bg-paper grid grid-cols-2 gap-x-4 gap-y-2 rounded-md p-3 text-sm">
            <dt className="text-ink/60">Period</dt>
            <dd className="text-right">{formatPeriod(preview.billingPeriod)}</dd>
            <dt className="text-ink/60">Readings</dt>
            <dd className="text-right tabular-nums">
              {formatKl(preview.previousReading)} → {formatKl(preview.currentReading)}
            </dd>
            <dt className="text-ink/60">Water used</dt>
            <dd className="text-right tabular-nums">{formatKl(preview.consumption)}</dd>
            <dt className="text-ink/60">Tariff</dt>
            <dd className="text-right tabular-nums">{formatCurrency(preview.tariffRate)}/kL</dd>
            <dt className="font-semibold">Amount</dt>
            <dd className="text-right font-bold tabular-nums">{formatCurrency(preview.amount)}</dd>
          </dl>
        )}
        {preview?.ok ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPreview(null)}
              disabled={busy !== null}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={() => run(false)} loading={busy === 'create'} className="flex-1">
              Create invoice
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => run(true)}
            loading={busy === 'preview'}
            className="w-full"
          >
            Preview invoice
          </Button>
        )}
      </div>
    </Card>
  )
}
