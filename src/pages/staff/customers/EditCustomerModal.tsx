import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import Button from '../../../components/Button'
import { FormInput, FormSelect } from '../../../components/FormField'
import Modal from '../../../components/Modal'
import { useToast } from '../../../hooks/useToast'
import type { CustomerDetailsInput } from '../../../services/customerQueries'
import { updateCustomerDetails } from '../../../services/customerService'
import { AREAS, type Area, type Customer } from '../../../types/models'
import { friendlyError } from '../../../utils/errors'
import { validateEmail, validateName, validatePhone } from '../../../utils/validation'

type Errors = Partial<Record<keyof CustomerDetailsInput, string | null>>

interface Props {
  customer: Customer
  open: boolean
  onClose: () => void
  onSaved: () => void
}

/** Call centre / admin: correct a customer's name, contact details or address. */
export default function EditCustomerModal({ customer, open, onClose, onSaved }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Edit customer details" description={customer.name}>
      {/* Remount each time it opens so the form starts from the saved values */}
      {open && <EditForm customer={customer} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  )
}

function EditForm({ customer, onClose, onSaved }: Omit<Props, 'open'>) {
  const { toast } = useToast()
  const initial: CustomerDetailsInput = {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    area: customer.area,
  }
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const changed = (Object.keys(initial) as (keyof CustomerDetailsInput)[]).some(
    (k) => values[k] !== initial[k],
  )
  const set = (field: keyof CustomerDetailsInput) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Errors = {
      name: validateName(values.name),
      email: values.email.trim() ? validateEmail(values.email) : null,
      phone: validatePhone(values.phone),
      address: values.address.trim() ? null : 'Enter the customer’s address.',
    }
    setErrors(next)
    setFormError(null)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    try {
      await updateCustomerDetails(customer.id, values)
      toast({ title: 'Details updated', message: `${values.name.trim()}’s details were saved.` })
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
      <FormInput
        label="Full name"
        value={values.name}
        onChange={set('name')}
        error={errors.name}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label="Email"
          type="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
        />
        <FormInput
          label="Mobile number"
          type="tel"
          value={values.phone}
          onChange={set('phone')}
          error={errors.phone}
        />
      </div>
      <FormInput
        label="Postal address"
        value={values.address}
        onChange={set('address')}
        error={errors.address}
        required
      />
      <FormSelect
        label="Area"
        value={values.area}
        onChange={(e) => setValues((v) => ({ ...v, area: e.target.value as Area }))}
      >
        {AREAS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </FormSelect>
      <p className="text-ink/60 text-sm">
        Property addresses are part of each account and are changed by the billing team.
      </p>
      <div className="border-mist flex justify-end gap-2 border-t pt-4">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={!changed}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
