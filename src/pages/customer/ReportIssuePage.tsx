import { Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Card from '../../components/Card'
import ErrorState from '../../components/ErrorState'
import { FormInput, FormSelect, FormTextarea } from '../../components/FormField'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import PageHeader from '../../components/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import {
  createTicket,
  loadReporterContext,
  type ReporterContext,
} from '../../services/ticketService'
import { AREAS, TICKET_TYPES, type Area, type Priority, type TicketType } from '../../types/models'
import { friendlyError } from '../../utils/errors'
import { SERIOUSNESS, typeLabel } from '../../utils/ticketDisplay'

const ELSEWHERE = 'elsewhere'

/** Customer: report a leak, burst pipe, outage or other problem. */
export default function ReportIssuePage() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const context = useAsync(uid ? () => loadReporterContext(uid) : null, `reporter:${uid}`)

  return (
    <>
      <PageHeader
        title="Report a problem"
        description="Tell us about a leak, burst pipe, no water or low pressure. You can follow progress under My Tickets."
      />
      {context.loading && (
        <Card className="max-w-2xl">
          <LoadingSkeleton lines={6} />
        </Card>
      )}
      {context.error ? (
        <Card className="max-w-2xl">
          <ErrorState message={friendlyError(context.error)} onRetry={context.reload} />
        </Card>
      ) : null}
      {context.data && <ReportForm context={context.data} />}
    </>
  )
}

function ReportForm({ context }: { context: ReporterContext }) {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const first = context.accounts[0]
  const [accountId, setAccountId] = useState<string>(first?.id ?? ELSEWHERE)
  const [type, setType] = useState<TicketType>('LEAK')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [location, setLocation] = useState(first?.propertyAddress ?? '')
  const [area, setArea] = useState<Area>(first?.area ?? context.customer?.area ?? AREAS[0])
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<{ location?: string; description?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  function chooseProperty(id: string) {
    setAccountId(id)
    const account = context.accounts.find((a) => a.id === id)
    if (account) {
      setLocation(account.propertyAddress)
      setArea(account.area)
    } else {
      setLocation('')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next = {
      location: location.trim() ? undefined : 'Tell us where the problem is.',
      description:
        description.trim().length >= 10
          ? undefined
          : 'Describe the problem in a few words (at least 10 characters).',
    }
    setErrors(next)
    if (next.location || next.description || !user) return
    setSending(true)
    setFailure(null)
    const name =
      context.customer?.name || profile?.displayName || user.displayName || user.email || 'Customer'
    try {
      const id = await createTicket(
        {
          customerId: user.uid,
          customerName: name,
          accountId: accountId === ELSEWHERE ? null : accountId,
          type,
          priority,
          location,
          area,
          description,
        },
        { uid: user.uid, name, role: 'customer' },
      )
      toast({ title: 'Report sent', message: 'We’ll keep you updated as it progresses.' })
      navigate(`/customer/tickets/${id}`)
    } catch (err) {
      setFailure(friendlyError(err))
      setSending(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {failure && <Alert tone="error">{failure}</Alert>}
        <FormSelect
          label="Where is the problem?"
          value={accountId}
          onChange={(e) => chooseProperty(e.target.value)}
        >
          {context.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.propertyAddress} (account {a.accountNumber})
            </option>
          ))}
          <option value={ELSEWHERE}>Somewhere else: a street, park or public place</option>
        </FormSelect>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormSelect
            label="What’s wrong?"
            value={type}
            onChange={(e) => setType(e.target.value as TicketType)}
          >
            {TICKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
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
          label="Exact location"
          hint="Street address, or a landmark such as “pavement outside the school gate”."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          error={errors.location}
          maxLength={200}
          required
        />

        <fieldset>
          <legend className="text-sm font-semibold">How serious is it?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {SERIOUSNESS.map((s) => (
              <label
                key={s.priority}
                className={`has-[:checked]:border-reservoir has-[:checked]:bg-reservoir/5 has-[:focus-visible]:ring-channel flex cursor-pointer flex-col rounded-md border px-3 py-2.5 text-sm has-[:focus-visible]:ring-2`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <input
                    type="radio"
                    name="seriousness"
                    value={s.priority}
                    checked={priority === s.priority}
                    onChange={() => setPriority(s.priority)}
                    className="accent-reservoir"
                  />
                  {s.label}
                </span>
                <span className="text-ink/60 mt-0.5 pl-6">{s.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <FormTextarea
          label="What can you see?"
          hint="For example: water bubbling up through the tar since this morning."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          maxLength={2000}
          required
        />

        <Alert tone="info">
          If water is flooding a road or property, or there’s a safety risk, also phone the
          Silulumanzi call centre.
        </Alert>

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={sending}
            icon={<Send className="size-4" aria-hidden="true" />}
          >
            {sending ? 'Sending…' : 'Send report'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
