import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import Button from '../../../components/Button'
import { FormInput, FormSelect } from '../../../components/FormField'
import Modal from '../../../components/Modal'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { addMeter } from '../../../services/meterService'
import type { Account } from '../../../types/models'
import { readingDateFrom, toDateInput } from '../../../utils/consumption'
import { friendlyError } from '../../../utils/errors'

type AccountOption = Account & { customerName: string }

interface Props {
  open: boolean
  onClose: () => void
  /** Accounts that don't have a meter yet. */
  accounts: AccountOption[]
  existingNumbers: string[]
  onAdded: (meterId: string) => void
}

/** Installs a meter on an account that doesn't have one (assigns meter → account). */
export default function AddMeterModal({ open, onClose, ...rest }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a meter"
      description="Install a meter on a property account."
    >
      {open && <AddMeterForm onClose={onClose} {...rest} />}
    </Modal>
  )
}

function AddMeterForm({ onClose, accounts, existingNumbers, onAdded }: Omit<Props, 'open'>) {
  const { user } = useAuth()
  const { toast } = useToast()
  const today = toDateInput(new Date())
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [meterNumber, setMeterNumber] = useState('')
  const [installed, setInstalled] = useState(today)
  const [initial, setInitial] = useState('0')
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (accounts.length === 0) {
    return (
      <div className="space-y-4">
        <Alert tone="info">
          Every open account already has a meter. Replacing a meter isn’t part of this MVP.
        </Alert>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const number = meterNumber.trim().toUpperCase()
    const value = Number(initial)
    const taken = existingNumbers.some((n) => n.toUpperCase() === number)
    const next = {
      meterNumber: !number
        ? 'Enter the number printed on the meter.'
        : number.length > 30
          ? 'Use 30 characters or fewer.'
          : taken
            ? 'A meter with this number already exists.'
            : null,
      installed: !installed
        ? 'Choose the installation date.'
        : installed > today
          ? 'The installation date can’t be in the future.'
          : null,
      initial:
        initial.trim() === '' || !Number.isFinite(value) || value < 0
          ? 'Enter the reading on the dial (0 or more).'
          : null,
    }
    setErrors(next)
    setFormError(null)
    if (Object.values(next).some(Boolean) || !user) return

    const account = accounts.find((a) => a.id === accountId)!
    setSaving(true)
    try {
      const meterId = await addMeter(
        {
          meterNumber: number,
          accountId: account.id,
          customerId: account.customerId,
          installationDate: readingDateFrom(installed),
          initialReading: Math.round(value * 10) / 10,
        },
        user.uid,
      )
      toast({
        title: 'Meter added',
        message: `${number} is now on account ${account.accountNumber}.`,
      })
      onClose()
      onAdded(meterId)
    } catch (error) {
      setFormError(friendlyError(error))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <FormSelect
        label="Account"
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        hint="Only accounts without a meter are listed."
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.accountNumber} · {a.customerName} · {a.propertyAddress}
          </option>
        ))}
      </FormSelect>
      <FormInput
        label="Meter number"
        value={meterNumber}
        onChange={(e) => setMeterNumber(e.target.value)}
        error={errors.meterNumber}
        placeholder="e.g. MTR-245570"
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label="Installed on"
          type="date"
          max={today}
          value={installed}
          onChange={(e) => setInstalled(e.target.value)}
          error={errors.installed}
          required
        />
        <FormInput
          label="Reading at installation (kL)"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.1}
          value={initial}
          onChange={(e) => setInitial(e.target.value)}
          error={errors.initial}
          required
        />
      </div>
      <div className="border-mist flex justify-end gap-2 border-t pt-4">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Add meter
        </Button>
      </div>
    </form>
  )
}
