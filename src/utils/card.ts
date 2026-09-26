/**
 * Card helpers for the payment form: formatting as you type and instant checks.
 * The server re-checks everything (functions/src/shared/payments.ts); a test keeps
 * the two sets of checks in agreement.
 */

export const cardDigits = (value: string) => value.replace(/\D/g, '')

/** "4242424242424242" → "4242 4242 4242 4242" (max 19 digits). */
export function formatCardNumber(value: string): string {
  return cardDigits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
}

/** "1228" → "12/28" as the customer types. */
export function formatExpiry(value: string): string {
  const d = cardDigits(value).slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

export function luhnValid(number: string): boolean {
  const digits = cardDigits(number)
  if (digits.length < 12 || digits.length > 19) return false
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

export function expiryValid(expiry: string, now = new Date()): boolean {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim())
  if (!m) return false
  const month = Number(m[1])
  if (month < 1 || month > 12) return false
  return new Date(2000 + Number(m[2]), month, 1) > now
}

export interface CardForm {
  name: string
  number: string
  expiry: string
  cvc: string
}

export function cardFormErrors(
  card: CardForm,
  now = new Date(),
): Partial<Record<keyof CardForm, string>> {
  const e: Partial<Record<keyof CardForm, string>> = {}
  if (!card.name.trim()) e.name = 'Enter the name on the card.'
  if (!luhnValid(card.number)) e.number = 'Check the card number.'
  if (!expiryValid(card.expiry, now))
    e.expiry = 'Enter a valid expiry date (MM/YY) that hasn’t passed.'
  if (!/^\d{3,4}$/.test(card.cvc.trim())) e.cvc = 'Enter the 3 or 4 digit security code.'
  return e
}

/** Sandbox cards for the demo (mirrors TEST_CARDS on the server). */
export const TEST_CARDS = [
  { number: '4242 4242 4242 4242', outcome: 'Payment succeeds' },
  { number: '4000 0000 0000 0002', outcome: 'Card is declined' },
  { number: '4000 0000 0000 9995', outcome: 'Insufficient funds' },
  { number: '4000 0000 0000 0119', outcome: 'Provider error (not charged)' },
] as const
