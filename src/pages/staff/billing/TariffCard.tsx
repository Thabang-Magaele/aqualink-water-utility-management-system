import { Pencil } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import { FormInput } from '../../../components/FormField'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import Modal from '../../../components/Modal'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { saveBillingSettings } from '../../../services/billingService'
import type { BillingSettings } from '../../../types/models'
import { friendlyError } from '../../../utils/errors'
import { formatCurrency, formatDate } from '../../../utils/format'

interface Props {
  settings: BillingSettings | undefined
  loading: boolean
  error: string | null
  onChanged: () => void
}

/** The simplified tariff used for new invoices. Administrators can change it. */
export default function TariffCard({ settings, loading, error, onChanged }: Props) {
  const { role } = useAuth()
  const [editing, setEditing] = useState(false)
  return (
    <Card
      title="Tariff"
      description="Applied to new invoices"
      actions={
        role === 'admin' && settings ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditing(true)}
            icon={<Pencil className="size-4" aria-hidden="true" />}
          >
            Change
          </Button>
        ) : undefined
      }
    >
      {loading && <LoadingSkeleton lines={2} />}
      {error && <Alert tone="error">{error}</Alert>}
      {settings && (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-ink/60">Rate</dt>
            <dd className="text-2xl font-bold tabular-nums">
              {formatCurrency(settings.tariffRate)}
              <span className="text-ink/60 text-base font-semibold"> per kL</span>
            </dd>
          </div>
          <div>
            <dt className="text-ink/60">Payment terms</dt>
            <dd className="font-semibold">{settings.paymentTermsDays} days</dd>
          </div>
          <p className="text-ink/55">
            {settings.updatedAt
              ? `Last changed ${formatDate(settings.updatedAt)}.`
              : 'Default tariff (not changed yet).'}{' '}
            Existing invoices keep the rate they were issued with.
          </p>
        </dl>
      )}
      {settings && (
        <Modal
          open={editing}
          onClose={() => setEditing(false)}
          title="Change the tariff"
          description="New invoices use the new values. Existing invoices don’t change."
        >
          {editing && (
            <TariffForm settings={settings} onClose={() => setEditing(false)} onSaved={onChanged} />
          )}
        </Modal>
      )}
    </Card>
  )
}

function TariffForm({
  settings,
  onClose,
  onSaved,
}: {
  settings: BillingSettings
  onClose: () => void
  onSaved: () => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [rate, setRate] = useState(String(settings.tariffRate))
  const [terms, setTerms] = useState(String(settings.paymentTermsDays))
  const [errors, setErrors] = useState<{ rate?: string | null; terms?: string | null }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const r = Number(rate)
    const t = Number(terms)
    const next = {
      rate:
        !Number.isFinite(r) || r <= 0 || r > 1000
          ? 'Enter a rate between R0.01 and R1 000 per kL.'
          : null,
      terms:
        !Number.isInteger(t) || t < 1 || t > 90
          ? 'Enter a whole number of days from 1 to 90.'
          : null,
    }
    setErrors(next)
    if (next.rate || next.terms || !user) return
    setSaving(true)
    setFormError(null)
    try {
      await saveBillingSettings({ tariffRate: r, paymentTermsDays: t }, user.uid)
      toast({ title: 'Tariff updated', message: `${formatCurrency(r)} per kL, due in ${t} days.` })
      onSaved()
      onClose()
    } catch (error) {
      setFormError(friendlyError(error))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label="Rate (rand per kL)"
          type="number"
          inputMode="decimal"
          step={0.01}
          min={0.01}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          error={errors.rate}
          required
        />
        <FormInput
          label="Payment terms (days)"
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          max={90}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          error={errors.terms}
          required
        />
      </div>
      <div className="border-mist flex justify-end gap-2 border-t pt-4">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save tariff
        </Button>
      </div>
    </form>
  )
}
