import { useEffect, useState } from 'react'
import Alert from '../../../components/Alert'
import Button from '../../../components/Button'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import Modal from '../../../components/Modal'
import { useToast } from '../../../hooks/useToast'
import { runBilling, type BillingRun } from '../../../services/billingService'
import { formatCurrency, formatKl } from '../../../utils/format'

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
}

/** Previews a billing run for every active metered account, then creates the invoices. */
export default function RunBillingModal({ open, onClose, onDone }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Run billing"
      description="Invoices every active account with new consumption since its last invoice."
      size="lg"
    >
      {open && <RunBilling onClose={onClose} onDone={onDone} />}
    </Modal>
  )
}

function RunBilling({ onClose, onDone }: Omit<Props, 'open'>) {
  const { toast } = useToast()
  const [preview, setPreview] = useState<BillingRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let active = true
    runBilling(true).then(
      (run) => active && setPreview(run),
      (e) => active && setError((e as Error).message),
    )
    return () => {
      active = false
    }
  }, [])

  async function confirm() {
    setRunning(true)
    setError(null)
    try {
      const run = await runBilling(false)
      // Count and total only what was actually written, not what was billable.
      const createdInvoices = run.accounts.filter((a) => a.ok && a.created)
      const created = createdInvoices.length
      const billed = createdInvoices.reduce((sum, a) => sum + (a.ok ? a.amount : 0), 0)
      toast({
        title: `${created} invoice${created === 1 ? '' : 's'} created`,
        message: `${formatCurrency(Math.round(billed * 100) / 100)} billed.`,
      })
      if (run.failed.length)
        toast({
          tone: 'error',
          title: `${run.failed.length} account(s) could not be billed`,
          message: 'Run billing again to retry them.',
        })
      onDone()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setRunning(false)
    }
  }

  if (error && !preview) return <Alert tone="error">{error}</Alert>
  if (!preview) return <LoadingSkeleton lines={5} label="Working out who to bill…" />

  const billable = preview.accounts.filter((a) => a.ok)
  const skipped = preview.accounts.filter((a) => !a.ok)

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-ink/70 text-sm">
        Tariff {formatCurrency(preview.settings.tariffRate)} per kL · due in{' '}
        {preview.settings.paymentTermsDays} days
      </p>

      {billable.length === 0 ? (
        <Alert tone="info" title="Nothing to bill">
          No account has new consumption since its last invoice. Record meter readings first.
        </Alert>
      ) : (
        <div className="border-mist overflow-x-auto rounded-md border">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">Invoices to be created</caption>
            <thead className="border-mist bg-paper text-ink/70 border-b">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Account
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Used
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-mist divide-y">
              {billable.map((a) =>
                a.ok ? (
                  <tr key={a.accountId}>
                    <td className="px-3 py-2 font-mono">{a.accountNumber}</td>
                    <td className="px-3 py-2">{a.customerName ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKl(a.consumption)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(a.amount)}
                    </td>
                  </tr>
                ) : null,
              )}
            </tbody>
            <tfoot className="border-ink/30 border-t">
              <tr>
                <th scope="row" colSpan={3} className="px-3 py-2 text-right font-bold">
                  Total
                </th>
                <td className="px-3 py-2 text-right font-bold tabular-nums">
                  {formatCurrency(preview.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {skipped.length > 0 && (
        <details className="text-sm">
          <summary className="text-ink/70 cursor-pointer font-semibold">
            {skipped.length} account{skipped.length === 1 ? '' : 's'} skipped
          </summary>
          <ul className="text-ink/70 mt-2 space-y-1">
            {skipped.map((a) => (
              <li key={a.accountId}>
                <span className="font-mono">{a.accountNumber}</span>
                {a.customerName && ` · ${a.customerName}`}: {!a.ok && a.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-mist flex justify-end gap-2 border-t pt-4">
        <Button variant="secondary" onClick={onClose} disabled={running}>
          Cancel
        </Button>
        <Button onClick={confirm} loading={running} disabled={billable.length === 0}>
          Create {billable.length} invoice{billable.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  )
}
