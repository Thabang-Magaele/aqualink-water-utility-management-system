import { Check } from 'lucide-react'
import type { ProgressStep } from '../../services/ticketActions'

/** Customer-facing progress: Reported → Technician assigned → Work in progress → Resolved. */
export default function TicketProgress({ steps }: { steps: ProgressStep[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-4" aria-label="Progress">
      {steps.map((step, i) => (
        <li
          key={step.label}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className={`flex items-center gap-3 rounded-lg border px-3 py-3 sm:flex-col sm:items-start sm:gap-2 ${
            step.state === 'current'
              ? 'border-reservoir bg-reservoir/5'
              : step.state === 'done'
                ? 'border-mist bg-white'
                : 'border-ink/20 text-ink/50 border-dashed bg-transparent'
          }`}
        >
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              step.state === 'upcoming' ? 'bg-ink/8 text-ink/50' : 'bg-reservoir text-white'
            }`}
          >
            {step.state === 'done' || (step.state === 'current' && i === steps.length - 1) ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              i + 1
            )}
          </span>
          <span className="text-sm font-semibold">
            {step.label}
            <span className="sr-only">
              {step.state === 'done'
                ? ' (done)'
                : step.state === 'current'
                  ? ' (current step)'
                  : ' (not yet)'}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
