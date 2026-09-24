import { useMemo, useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import Button from '../../../components/Button'
import { FormInput, FormSelect, FormTextarea } from '../../../components/FormField'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import Modal from '../../../components/Modal'
import SearchBar from '../../../components/SearchBar'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { loadCustomer, loadCustomerDirectory } from '../../../services/customerService'
import { createTicket } from '../../../services/ticketService'
import {
  AREAS,
  PRIORITIES,
  TICKET_TYPES,
  type Area,
  type Priority,
  type TicketType,
} from '../../../types/models'
import { matchesCustomer, type CustomerSummary } from '../../../utils/customerSearch'
import { friendlyError } from '../../../utils/errors'
import { typeLabel } from '../../../utils/ticketDisplay'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (ticketId: string) => void
}

/** Call centre: log a report on a customer's behalf (e.g. a phone call). */
export default function LogTicketModal({ open, onClose, onCreated }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a ticket"
      description="For a report received by phone or in person."
      size="lg"
    >
      {open && <LogTicketForm onClose={onClose} onCreated={onCreated} />}
    </Modal>
  )
}

function LogTicketForm({ onClose, onCreated }: Omit<Props, 'open'>) {
  const directory = useAsync(loadCustomerDirectory, 'log-ticket-directory')
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState<CustomerSummary | null>(null)
  const matches = useMemo(
    () =>
      search.trim().length >= 2
        ? (directory.data?.customers ?? []).filter((c) => matchesCustomer(c, search)).slice(0, 6)
        : [],
    [directory.data, search],
  )

  if (!customer) {
    return (
      <div className="space-y-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Find the customer by name, phone or account number"
        />
        {directory.loading && <LoadingSkeleton lines={3} />}
        {directory.error ? <Alert tone="error">{friendlyError(directory.error)}</Alert> : null}
        {matches.length > 0 && (
          <ul
            className="divide-mist border-mist divide-y rounded-md border"
            aria-label="Matching customers"
          >
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCustomer(c)}
                  className="hover:bg-paper w-full px-4 py-3 text-left"
                >
                  <span className="block font-semibold">{c.name}</span>
                  <span className="text-ink/60 block text-sm">
                    {c.address} · {c.accountNumbers.join(', ') || 'no accounts'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {search.trim().length >= 2 && directory.data && matches.length === 0 && (
          <p className="text-ink/60 text-sm">No customer matches “{search}”.</p>
        )}
      </div>
    )
  }
  return (
    <DetailsForm
      customer={customer}
      onBack={() => setCustomer(null)}
      onClose={onClose}
      onCreated={onCreated}
    />
  )
}

function DetailsForm({
  customer,
  onBack,
  onClose,
  onCreated,
}: { customer: CustomerSummary; onBack: () => void } & Omit<Props, 'open'>) {
  const { user, profile, role } = useAuth()
  const { toast } = useToast()
  const detail = useAsync(() => loadCustomer(customer.id), `log-ticket:${customer.id}`)
  const accounts = detail.data?.accounts ?? []
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState<TicketType>('LEAK')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [location, setLocation] = useState(customer.address)
  const [area, setArea] = useState<Area>(customer.area)
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<{ location?: string; description?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function chooseAccount(id: string) {
    setAccountId(id)
    const a = accounts.find((x) => x.id === id)
    if (a) {
      setLocation(a.propertyAddress)
      setArea(a.area)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next = {
      location: location.trim() ? undefined : 'Enter where the problem is.',
      description:
        description.trim().length >= 10
          ? undefined
          : 'Describe the problem (at least 10 characters).',
    }
    setErrors(next)
    if (next.location || next.description || !user || !role) return
    setSaving(true)
    setFailure(null)
    try {
      const actor = {
        uid: user.uid,
        name: profile?.displayName || user.displayName || 'Call centre',
        role,
      }
      const id = await createTicket(
        {
          customerId: customer.id,
          customerName: customer.name,
          accountId: accountId || null,
          type,
          priority,
          location,
          area,
          description,
        },
        actor,
      )
      toast({ title: 'Ticket logged', message: `Logged for ${customer.name}.` })
      onClose()
      onCreated(id)
    } catch (err) {
      setFailure(friendlyError(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {failure && <Alert tone="error">{failure}</Alert>}
      <p className="bg-paper flex items-center justify-between rounded-md px-3 py-2 text-sm">
        <span>
          For <strong>{customer.name}</strong>
        </span>
        <button
          type="button"
          onClick={onBack}
          className="text-channel font-semibold hover:underline"
        >
          Change
        </button>
      </p>
      <FormSelect
        label="Account"
        value={accountId}
        onChange={(e) => chooseAccount(e.target.value)}
        disabled={detail.loading}
      >
        <option value="">Not linked to an account</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.accountNumber}: {a.propertyAddress}
          </option>
        ))}
      </FormSelect>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormSelect
          label="Issue"
          value={type}
          onChange={(e) => setType(e.target.value as TicketType)}
        >
          {TICKET_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p[0] + p.slice(1).toLowerCase()}
            </option>
          ))}
        </FormSelect>
        <FormSelect label="Area" value={area} onChange={(e) => setArea(e.target.value as Area)}>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </FormSelect>
      </div>
      <FormInput
        label="Location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        error={errors.location}
        maxLength={200}
        required
      />
      <FormTextarea
        label="What the caller reported"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
        maxLength={2000}
        rows={3}
        required
      />
      <div className="border-mist flex justify-end gap-2 border-t pt-4">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Log ticket
        </Button>
      </div>
    </form>
  )
}
