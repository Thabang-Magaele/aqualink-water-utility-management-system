/**
 * Payment rules and the payment-provider boundary. Pure: no Firebase here,
 * so everything is unit-tested in tests/functions/payments.test.ts.
 *
 * PaymentProvider is the seam for a real gateway (PayFast, Yoco, Peach Payments…).
 * The MVP uses the mock provider below. A real integration would normally use the
 * gateway's hosted checkout, so card details never reach AquaLink's servers at all.
 */
import { roundMoney } from './billing'

export type PaymentMethod = 'CARD' | 'EFT' | 'CASH'
export type Role = string

// ---------------------------------------------------------------- cards

/** Digits only: "4242 4242-4242 4242" → "4242424242424242". */
export function cardDigits(number: string): string {
  return number.replace(/[\s-]/g, '')
}

/** The Luhn checksum every real card number satisfies (catches typos). */
export function luhnValid(number: string): boolean {
  const digits = cardDigits(number)
  if (!/^\d{12,19}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function cardBrand(number: string): string {
  const d = cardDigits(number)
  if (/^4/.test(d)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'American Express'
  return 'Card'
}

/** "MM/YY" → true if it's a real month that hasn't ended yet. */
export function expiryValid(expiry: string, now = new Date()): boolean {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim())
  if (!m) return false
  const month = Number(m[1])
  const year = 2000 + Number(m[2])
  if (month < 1 || month > 12) return false
  // Valid until the end of the expiry month
  return new Date(year, month, 1) > now
}

export interface CardInput {
  name: string
  number: string
  expiry: string
  cvc: string
}

/** Field-by-field problems with a card, or null if it looks valid. */
export function cardProblems(
  card: CardInput,
  now = new Date(),
): Partial<Record<keyof CardInput, string>> | null {
  const problems: Partial<Record<keyof CardInput, string>> = {}
  if (!card.name?.trim() || card.name.trim().length > 100)
    problems.name = 'Enter the name on the card.'
  if (!luhnValid(card.number ?? '')) problems.number = 'Check the card number.'
  if (!expiryValid(card.expiry ?? '', now))
    problems.expiry = 'Enter a valid expiry date (MM/YY) that hasn’t passed.'
  if (!/^\d{3,4}$/.test((card.cvc ?? '').trim()))
    problems.cvc = 'Enter the 3 or 4 digit security code.'
  return Object.keys(problems).length ? problems : null
}

// ---------------------------------------------------------------- provider

export interface ChargeRequest {
  /** Rand, already rounded to cents. */
  amount: number
  /** Our payment ID, sent so the gateway can de-duplicate too. */
  paymentId: string
  card: CardInput
}

export type ChargeResult =
  | { ok: true; reference: string }
  | {
      ok: false
      code: 'CARD_DECLINED' | 'INSUFFICIENT_FUNDS' | 'PROCESSING_ERROR'
      message: string
    }

export interface PaymentProvider {
  /** Stored on each payment, e.g. "MOCK". */
  name: string
  charge(request: ChargeRequest): Promise<ChargeResult>
  refund(reference: string): Promise<void>
}

/** Test cards for the mock provider (fictional, like real gateways' sandbox cards). */
export const TEST_CARDS = {
  SUCCESS: '4242 4242 4242 4242',
  DECLINED: '4000 0000 0000 0002',
  INSUFFICIENT_FUNDS: '4000 0000 0000 9995',
  PROVIDER_ERROR: '4000 0000 0000 0119',
} as const

const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/**
 * Sandbox provider: no money moves. The outcome depends only on the card number,
 * so demos and tests are predictable. Any other valid card number succeeds.
 */
export function createMockProvider(
  options: { delayMs?: number; random?: () => number } = {},
): PaymentProvider {
  const { delayMs = 0, random = Math.random } = options
  const wait = () => (delayMs > 0 ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve())
  return {
    name: 'MOCK',
    async charge({ card }) {
      await wait()
      switch (cardDigits(card.number)) {
        case cardDigits(TEST_CARDS.DECLINED):
          return {
            ok: false,
            code: 'CARD_DECLINED',
            message: 'Your card was declined. Try another card or contact your bank.',
          }
        case cardDigits(TEST_CARDS.INSUFFICIENT_FUNDS):
          return {
            ok: false,
            code: 'INSUFFICIENT_FUNDS',
            message: 'The card has insufficient funds.',
          }
        case cardDigits(TEST_CARDS.PROVIDER_ERROR):
          return {
            ok: false,
            code: 'PROCESSING_ERROR',
            message: 'The payment provider had a problem. You have not been charged. Try again.',
          }
      }
      let ref = 'MOCK-'
      for (let i = 0; i < 8; i++) ref += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)]
      return { ok: true, reference: ref }
    },
    async refund() {
      await wait()
    },
  }
}

// ---------------------------------------------------------------- requests

export interface PaymentRequest {
  invoiceId: string
  method: PaymentMethod
  /** One per payment attempt, chosen by the browser. Makes retries safe. */
  idempotencyKey: string
  card?: CardInput
  /** EFT bank reference or cash receipt number (staff-recorded payments). */
  reference?: string
}

/** Validates the request body shape. Returns the request or a message for a 400. */
export function parsePaymentRequest(body: unknown): PaymentRequest | string {
  const b = (body ?? {}) as Record<string, unknown>
  if (typeof b.invoiceId !== 'string' || !b.invoiceId || b.invoiceId.length > 200)
    return 'A valid invoice ID is required.'
  if (b.method !== 'CARD' && b.method !== 'EFT' && b.method !== 'CASH')
    return 'Choose card, EFT or cash.'
  if (typeof b.idempotencyKey !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(b.idempotencyKey))
    return 'A valid payment attempt key is required.'
  if (b.method === 'CARD') {
    const c = b.card as Record<string, unknown> | undefined
    if (
      !c ||
      typeof c !== 'object' ||
      ['name', 'number', 'expiry', 'cvc'].some((k) => typeof c[k] !== 'string')
    )
      return 'Card details are required.'
    return {
      invoiceId: b.invoiceId,
      method: 'CARD',
      idempotencyKey: b.idempotencyKey,
      card: c as unknown as CardInput,
    }
  }
  const reference = typeof b.reference === 'string' ? b.reference.trim() : ''
  if (b.method === 'EFT' && !/^[A-Za-z0-9 /-]{3,40}$/.test(reference))
    return 'Enter the EFT bank reference (3–40 characters).'
  if (reference && !/^[A-Za-z0-9 /-]{3,40}$/.test(reference))
    return 'Use 3–40 letters, digits, spaces, / or - for the reference.'
  return {
    invoiceId: b.invoiceId,
    method: b.method,
    idempotencyKey: b.idempotencyKey,
    reference: reference || undefined,
  }
}

/**
 * Who may pay what. Customers pay their own invoices by card; billing and admin
 * staff may take a card payment on a customer's behalf or record EFT and cash.
 * Returns null if allowed, or a message for a 403.
 */
export function paymentNotAllowed(
  caller: { uid: string; role: Role },
  invoiceCustomerId: string,
  method: PaymentMethod,
): string | null {
  const staff = caller.role === 'admin' || caller.role === 'billing'
  if (staff) return null
  if (caller.role !== 'customer') return 'You do not have permission to take payments.'
  if (caller.uid !== invoiceCustomerId) return 'You can only pay your own invoices.'
  if (method !== 'CARD') return 'Only billing staff can record EFT and cash payments.'
  return null
}

/** Payments are only possible on invoices that are still owed. */
export function isPayable(status: string): boolean {
  return status === 'UNPAID' || status === 'OVERDUE'
}

/** Deterministic payment ID: the same attempt always maps to the same document. */
export function paymentIdFor(invoiceId: string, idempotencyKey: string): string {
  return `${invoiceId}_${idempotencyKey}`
}

export function balanceAfterPayment(balance: number, amount: number): number {
  return roundMoney(balance - amount)
}

/** Receipt number for staff-recorded payments without one, e.g. "CASH-4K7P2Q". */
export function manualReference(method: 'EFT' | 'CASH', random = Math.random): string {
  let ref = `${method}-`
  for (let i = 0; i < 6; i++) ref += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)]
  return ref
}

const rand = (amount: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)

/** In-app message to the customer when a payment succeeds. */
export function paymentNotification(p: {
  customerId: string
  invoiceId: string
  invoiceNumber: string
  amount: number
  reference: string
}) {
  return {
    userId: p.customerId,
    type: 'PAYMENT' as const,
    relatedId: p.invoiceId,
    link: `/customer/bills/${p.invoiceId}`,
    title: 'Payment received',
    message: `Thank you. ${rand(p.amount)} for ${p.invoiceNumber} was received (reference ${p.reference}).`,
  }
}
