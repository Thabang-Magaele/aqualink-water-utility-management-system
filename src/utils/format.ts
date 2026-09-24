/** Consistent South African formatting for money, dates and numbers. */

const currency = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })
const number = new Intl.NumberFormat('en-ZA')

export const formatCurrency = (amount: number) => currency.format(amount)
export const formatNumber = (value: number) => number.format(value)

type DateInput = Date | { toDate: () => Date } | null | undefined

function toDate(value: DateInput): Date | null {
  if (!value) return null
  return value instanceof Date ? value : value.toDate()
}

/** e.g. "23 Sept 2026". Accepts a Date or a Firestore Timestamp. */
export function formatDate(value: DateInput): string {
  const date = toDate(value)
  return date
    ? date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'
}

/** e.g. "23 Sept 2026, 14:05". */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value)
  return date
    ? date.toLocaleString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
}

/** e.g. "5 min ago", "2 days ago". */
export function formatRelative(value: DateInput, now = new Date()): string {
  const date = toDate(value)
  if (!date) return '—'
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en-ZA', { numeric: 'auto' })
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

/** "Thandi Mokoena" → "TM" */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (
    ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() ||
    '?'
  )
}

/** "0821234567" → "082 123 4567"; other formats are returned unchanged. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\s/g, '')
  const local = /^\+27\d{9}$/.test(digits) ? `0${digits.slice(3)}` : digits
  return /^0\d{9}$/.test(local)
    ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
    : phone
}
