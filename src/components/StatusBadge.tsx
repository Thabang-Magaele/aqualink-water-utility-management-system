import { statusStyle, TONE_CLASSES, type Tone } from '../utils/status'

interface StatusBadgeProps {
  /** A status code such as OPEN, PAID or ALERT. See utils/status.ts. */
  status: string
  /** Override the label or tone when needed. */
  label?: string
  tone?: Tone
}

export default function StatusBadge({ status, label, tone }: StatusBadgeProps) {
  const style = statusStyle(status)
  const classes = TONE_CLASSES[tone ?? style.tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${classes.badge}`}
    >
      <span className={`size-1.5 rounded-full ${classes.dot}`} aria-hidden="true" />
      {label ?? style.label}
    </span>
  )
}
