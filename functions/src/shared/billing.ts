/**
 * Billing decisions: pure functions, no Firebase. Unit-tested in tests/functions/billing.test.ts.
 *
 *   previous reading = the last invoice's closing reading (or the meter's baseline)
 *   consumption      = current reading − previous reading        (kL)
 *   amount           = consumption × tariff rate                 (rand)
 *
 * Keep roundMoney / calculateConsumption identical to src/utils/domain.ts
 * (a test checks they agree).
 */

export interface BillingSettings {
  /** Rand per kilolitre. */
  tariffRate: number
  /** Days from issue to due date. */
  paymentTermsDays: number
}

/** Used until an administrator saves settings/billing. Keep in sync with src/services/billingQueries.ts. */
export const DEFAULT_BILLING: BillingSettings = { tariffRate: 28.5, paymentTermsDays: 21 }

/** Billing periods and due dates follow South African time, whatever the server's clock zone. */
export const BILLING_TIME_ZONE = 'Africa/Johannesburg'

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function calculateConsumption(previousReading: number, currentReading: number): number {
  return Math.max(0, Math.round((currentReading - previousReading) * 1000) / 1000)
}

/** "YYYY-MM" for a date as seen in South Africa. */
export function billingPeriodOf(date: Date, timeZone = BILLING_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}`
}

export function isValidSettings(value: unknown): value is BillingSettings {
  const s = value as Partial<BillingSettings> | null
  return (
    !!s &&
    typeof s.tariffRate === 'number' &&
    s.tariffRate > 0 &&
    s.tariffRate <= 1000 &&
    Number.isInteger(s.paymentTermsDays) &&
    (s.paymentTermsDays as number) >= 1 &&
    (s.paymentTermsDays as number) <= 90
  )
}

export interface BillableAccount {
  id: string
  accountNumber: string
  customerId: string
  status: string
  meterId: string | null
  balance: number
}

export interface ReadingPoint {
  id: string
  value: number
  date: Date
}

export type SkipReason = 'ACCOUNT_NOT_ACTIVE' | 'NO_METER' | 'NO_READINGS' | 'NOTHING_TO_BILL'

export interface InvoicePlanOk {
  ok: true
  /** Deterministic: one invoice per closing reading, so billing can't run twice for it. */
  invoiceId: string
  invoiceNumber: string
  billingPeriod: string
  previousReading: number
  currentReading: number
  consumption: number
  tariffRate: number
  amount: number
  dueDate: Date
  /** The account balance after this invoice is added. */
  newBalance: number
}

export interface InvoicePlanSkip {
  ok: false
  reason: SkipReason
  message: string
}

export type InvoicePlan = InvoicePlanOk | InvoicePlanSkip

export interface PlanInput {
  account: BillableAccount
  /** Readings for the account's current meter, any order. */
  readings: ReadingPoint[]
  /** Closing reading of the account's most recent invoice, or null if never billed. */
  lastInvoicedReading: number | null
  /** How many invoices the account already has in the closing reading's billing period. */
  invoicesInPeriod: number
  settings: BillingSettings
  now: Date
}

const DAY_MS = 86_400_000

/** The newest reading, or null. */
export function latestReading(readings: ReadingPoint[]): ReadingPoint | null {
  return readings.reduce<ReadingPoint | null>(
    (latest, r) => (!latest || r.date > latest.date ? r : latest),
    null,
  )
}

/** Decides whether an account can be billed now, and exactly what the invoice would be. */
export function planInvoice({
  account,
  readings,
  lastInvoicedReading,
  invoicesInPeriod,
  settings,
  now,
}: PlanInput): InvoicePlan {
  if (account.status !== 'ACTIVE') {
    return {
      ok: false,
      reason: 'ACCOUNT_NOT_ACTIVE',
      message: `Account is ${account.status.toLowerCase()}.`,
    }
  }
  if (!account.meterId)
    return { ok: false, reason: 'NO_METER', message: 'No meter is installed on this account.' }

  const latest = latestReading(readings)
  if (!latest)
    return { ok: false, reason: 'NO_READINGS', message: 'The meter has no readings yet.' }

  const oldest = [...readings].sort((a, b) => a.date.getTime() - b.date.getTime())[0]
  const previous = lastInvoicedReading ?? oldest.value
  if (latest.value <= previous) {
    return {
      ok: false,
      reason: 'NOTHING_TO_BILL',
      message:
        lastInvoicedReading === null
          ? 'Only the installation reading exists. Record a reading first.'
          : `No new consumption since the last invoice (${previous} kL). Record a new reading first.`,
    }
  }

  const consumption = calculateConsumption(previous, latest.value)
  const billingPeriod = billingPeriodOf(latest.date)
  const sequence = invoicesInPeriod + 1
  const amount = roundMoney(consumption * settings.tariffRate)

  return {
    ok: true,
    invoiceId: `${account.id}_${latest.id}`,
    invoiceNumber: `INV-${billingPeriod.replace('-', '')}-${account.accountNumber}${sequence > 1 ? `-${sequence}` : ''}`,
    billingPeriod,
    previousReading: previous,
    currentReading: latest.value,
    consumption,
    tariffRate: settings.tariffRate,
    amount,
    dueDate: new Date(now.getTime() + settings.paymentTermsDays * DAY_MS),
    newBalance: roundMoney(account.balance + amount),
  }
}

export interface OverdueCandidate {
  id: string
  status: string
  dueDate: Date
}

/** Unpaid invoices whose due date has passed. */
export function overdueInvoices<T extends OverdueCandidate>(invoices: T[], now: Date): T[] {
  return invoices.filter((i) => i.status === 'UNPAID' && i.dueDate.getTime() < now.getTime())
}

export interface InvoiceNotificationDraft {
  userId: string
  title: string
  message: string
  type: 'BILLING'
  relatedId: string
  link: string
}

const rand = (amount: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
const day = (date: Date) =>
  date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: BILLING_TIME_ZONE,
  })

/** In-app message to the customer when an invoice is issued or becomes overdue. */
export function invoiceNotification(
  kind: 'issued' | 'overdue',
  invoice: { id: string; customerId: string; invoiceNumber: string; amount: number; dueDate: Date },
): InvoiceNotificationDraft {
  return {
    userId: invoice.customerId,
    type: 'BILLING',
    relatedId: invoice.id,
    link: `/customer/bills/${invoice.id}`,
    title: kind === 'issued' ? 'New invoice' : 'Invoice overdue',
    message:
      kind === 'issued'
        ? `${invoice.invoiceNumber} for ${rand(invoice.amount)} is due on ${day(invoice.dueDate)}.`
        : `${invoice.invoiceNumber} for ${rand(invoice.amount)} was due on ${day(invoice.dueDate)}. Please pay as soon as possible.`,
  }
}
