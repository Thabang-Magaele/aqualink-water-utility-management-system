/**
 * One place that decides how every status in AquaLink looks.
 * Colour is never the only signal: badges always show the text label too.
 */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

interface StatusStyle {
  label: string
  tone: Tone
}

export const STATUS_STYLES: Record<string, StatusStyle> = {
  // Tickets
  OPEN: { label: 'Open', tone: 'info' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning' },
  ESCALATED: { label: 'Escalated', tone: 'danger' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  // Invoices
  UNPAID: { label: 'Unpaid', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  // Payments
  PENDING: { label: 'Pending', tone: 'neutral' },
  SUCCESS: { label: 'Successful', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  // Water quality
  NORMAL: { label: 'Normal', tone: 'success' },
  ALERT: { label: 'Alert', tone: 'danger' },
  // Assets, meters, accounts
  ACTIVE: { label: 'Active', tone: 'success' },
  INACTIVE: { label: 'Inactive', tone: 'neutral' },
  MAINTENANCE: { label: 'Maintenance', tone: 'warning' },
  OFFLINE: { label: 'Offline', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
  FAULTY: { label: 'Faulty', tone: 'danger' },
  REMOVED: { label: 'Removed', tone: 'neutral' },
  // Outage notices
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  // Severity / priority
  LOW: { label: 'Low', tone: 'neutral' },
  MEDIUM: { label: 'Medium', tone: 'info' },
  HIGH: { label: 'High', tone: 'warning' },
  CRITICAL: { label: 'Critical', tone: 'danger' },
}

export function statusStyle(status: string): StatusStyle {
  return (
    STATUS_STYLES[status] ?? {
      label: status
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/^\w/, (c) => c.toUpperCase()),
      tone: 'neutral',
    }
  )
}

/** Tailwind classes per tone, shared by badges, stat cards and alerts. */
export const TONE_CLASSES: Record<Tone, { badge: string; dot: string; icon: string }> = {
  neutral: {
    badge: 'bg-ink/5 text-ink/75 ring-ink/15',
    dot: 'bg-ink/45',
    icon: 'bg-ink/5 text-ink/70',
  },
  info: {
    badge: 'bg-channel/10 text-channel ring-channel/25',
    dot: 'bg-channel',
    icon: 'bg-channel/10 text-channel',
  },
  success: {
    badge: 'bg-clear/10 text-clear ring-clear/25',
    dot: 'bg-clear',
    icon: 'bg-clear/10 text-clear',
  },
  warning: {
    badge: 'bg-signal/12 text-signal-ink ring-signal/30',
    dot: 'bg-signal',
    icon: 'bg-signal/12 text-signal-ink',
  },
  danger: {
    badge: 'bg-fault/8 text-fault ring-fault/25',
    dot: 'bg-fault',
    icon: 'bg-fault/8 text-fault',
  },
}
