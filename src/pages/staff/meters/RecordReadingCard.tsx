import { TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import { FormInput } from '../../../components/FormField'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { recordReading } from '../../../services/meterService'
import type { Meter } from '../../../types/models'
import { calculateConsumption } from '../../../utils/domain'
import {
  readingDateFrom,
  toDateInput,
  UNUSUAL_USAGE_RATIO,
  usageRatio,
  type ConsumptionPeriod,
} from '../../../utils/consumption'
import { friendlyError } from '../../../utils/errors'
import { formatDate, formatKl } from '../../../utils/format'

interface Props {
  meter: Meter
  series: ConsumptionPeriod[]
  onSaved: () => void
}

/** Records a new cumulative reading, with checks that catch common mistakes. */
export default function RecordReadingCard({ meter, series, onSaved }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const today = toDateInput(new Date())
  const lastDate = meter.lastReadingDate?.toDate() ?? null
  const minDate = lastDate ? toDateInput(lastDate) : undefined
  const [value, setValue] = useState('')
  const [date, setDate] = useState(today)
  const [errors, setErrors] = useState<{ value?: string | null; date?: string | null }>({})
  const [warning, setWarning] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (meter.status !== 'ACTIVE') {
    return (
      <Card title="Record a reading">
        <Alert tone="info">
          This meter is marked {meter.status.toLowerCase()}, so no new readings can be recorded.
        </Alert>
      </Card>
    )
  }

  function reset() {
    setValue('')
    setDate(toDateInput(new Date()))
    setWarning(null)
    setErrors({})
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const reading = Math.round(Number(value) * 10) / 10
    const when = date ? readingDateFrom(date) : null
    const next = {
      value:
        value.trim() === '' || !Number.isFinite(Number(value))
          ? 'Enter the number on the meter’s dial.'
          : reading < meter.lastReading
            ? `Can’t be lower than the last reading (${formatKl(meter.lastReading)}). Check the dial; if the meter was replaced, contact an administrator.`
            : null,
      date: !date
        ? 'Choose the reading date.'
        : date > today
          ? 'The reading date can’t be in the future.'
          : lastDate && when! < lastDate
            ? `Must be on or after the last reading (${formatDate(lastDate)}).`
            : null,
    }
    setErrors(next)
    setFormError(null)
    if (next.value || next.date || !when || !user) return

    // Unusually high use is usually a misread digit: ask once before saving.
    const ratio = usageRatio(series, reading, when)
    if (ratio !== null && ratio >= UNUSUAL_USAGE_RATIO && !warning) {
      setWarning(
        `That’s about ${Math.round(ratio)} times this meter’s normal daily use. Check the digits, then save again if it’s correct.`,
      )
      return
    }

    // Work these out before saving: afterwards `meter` may already show the new reading.
    const used = calculateConsumption(meter.lastReading, reading)
    setSaving(true)
    try {
      await recordReading(meter, reading, when, user.uid)
      toast({
        title: 'Reading saved',
        message: `${formatKl(used)} used since ${lastDate ? formatDate(lastDate) : 'installation'}.`,
      })
      reset()
      onSaved()
    } catch (error) {
      setFormError(friendlyError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title="Record a reading"
      description={`Last reading ${formatKl(meter.lastReading)}${lastDate ? ` on ${formatDate(lastDate)}` : ''}`}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormInput
          label="Reading on the dial (kL)"
          type="number"
          inputMode="decimal"
          min={meter.lastReading}
          step={0.1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setWarning(null)
          }}
          error={errors.value}
          required
        />
        <FormInput
          label="Date read"
          type="date"
          min={minDate}
          max={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setWarning(null)
          }}
          error={errors.date}
          required
        />
        {warning && (
          <div
            className="border-signal/35 bg-signal/8 text-signal-ink flex items-start gap-2 rounded-md border px-3.5 py-3 text-sm"
            role="alert"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{warning}</p>
          </div>
        )}
        <Button type="submit" loading={saving} className="w-full">
          {warning ? 'Save anyway' : 'Save reading'}
        </Button>
      </form>
    </Card>
  )
}
