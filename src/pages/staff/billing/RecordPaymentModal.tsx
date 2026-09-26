import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import Button from '../../../components/Button'
import { FormInput, FormSelect } from '../../../components/FormField'
import Modal from '../../../components/Modal'
import { useToast } from '../../../hooks/useToast'
import { newAttemptKey, recordPayment } from '../../../services/paymentService'
import type { Invoice } from '../../../types/models'
import { friendlyError } from '../../../utils/errors'
import { formatCurrency } from '../../../utils/format'

interface Props {
  invoice: Invoice
  open: boolean
  onClose: () => void
  onRecorded: () => void
}

/** Billing / admin: record a payment received by EFT or at the office in cash. */
export default function RecordPaymentModal({ invoice, open, onClose, onRecorded }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      description={`${invoice.invoiceNumber} · ${formatCurrency(invoice.amount)}`}
    >
      {open && <RecordForm invoice={invoice} onClose={onClose} onRecorded={onRecorded} />}
    </Modal>
  )
}

function RecordForm({ invoice, onClose, onRecorded }: Omit<Props, 'open'>) {
  const { toast } = useToast()
  const [method, setMethod] = useState<'EFT' | 'CASH'>('EFT')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // One key per dialog: a double click or a retry can't record the payment twice
  const [attemptKey] = useState(newAttemptKey)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const ref = reference.trim()
    const problem =
      method === 'EFT' && !ref
        ? 'Enter the bank reference from the EFT.'
        : ref && !/^[A-Za-z0-9 /-]{3,40}$/.test(ref)
          ? 'Use 3–40 letters, digits, spaces, / or -.'
          : null
    setError(problem)
    setFormError(null)
    if (problem) return
    setSaving(true)
    try {
      const outcome = await recordPayment(invoice.id, method, ref, attemptKey)
      if (outcome.status !== 'SUCCESS') {
        setFormError(outcome.message)
        setSaving(false)
        return
      }
      toast({
        title: 'Payment recorded',
        message: `${formatCurrency(outcome.amount)} · reference ${outcome.reference}`,
      })
      onRecorded()
      onClose()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : friendlyError(e))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <p className="text-ink/70 text-sm">
        The invoice is marked paid in full and the account balance goes down by{' '}
        {formatCurrency(invoice.amount)}.
      </p>
      <FormSelect
        label="How was it paid?"
        value={method}
        onChange={(e) => setMethod(e.target.value as 'EFT' | 'CASH')}
      >
        <option value="EFT">EFT (bank transfer)</option>
        <option value="CASH">Cash at the office</option>
      </FormSelect>
      <FormInput
        label={method === 'EFT' ? 'Bank reference' : 'Receipt number (optional)'}
        hint={method === 'CASH' ? 'Leave empty and AquaLink will make one.' : undefined}
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        error={error}
        required={method === 'EFT'}
      />
      <div className="border-mist flex justify-end gap-2 border-t pt-4">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Record {formatCurrency(invoice.amount)}
        </Button>
      </div>
    </form>
  )
}
