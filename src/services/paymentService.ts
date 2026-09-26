/**
 * Payments go through the `payment` Cloud Function; the browser never writes
 * payments or marks invoices paid itself (see docs/security.md).
 */
import type { CardForm } from '../utils/card'
import { apiPost } from './api'

export interface PaymentOutcome {
  paymentId: string
  status: 'SUCCESS' | 'FAILED'
  amount: number
  reference: string | null
  message: string
  invoiceId: string
  invoiceNumber: string
  /** True when the server recognised a retry of an earlier attempt. */
  repeated: boolean
}

/** A fresh key for each payment attempt. Retrying with the same key can never charge twice. */
export function newAttemptKey(): string {
  return crypto.randomUUID()
}

export function payByCard(
  invoiceId: string,
  card: CardForm,
  attemptKey: string,
): Promise<PaymentOutcome> {
  return apiPost<PaymentOutcome>('payment', {
    invoiceId,
    method: 'CARD',
    idempotencyKey: attemptKey,
    card,
  })
}

/** Billing / admin: record an EFT or cash payment received at the office. */
export function recordPayment(
  invoiceId: string,
  method: 'EFT' | 'CASH',
  reference: string,
  attemptKey: string,
): Promise<PaymentOutcome> {
  return apiPost<PaymentOutcome>('payment', {
    invoiceId,
    method,
    idempotencyKey: attemptKey,
    reference,
  })
}
