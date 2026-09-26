/**
 * Firestore side of payments (Admin SDK). The rules live in payments.ts.
 *
 * processPayment():
 *   1. Checks the invoice and who is paying.
 *   2. Creates a PENDING payment whose ID comes from the browser's one-time key.
 *      If that document already exists, this is a retry: the earlier result is
 *      returned and nothing is charged again.
 *   3. Charges the provider OUTSIDE any transaction (transactions can retry; a
 *      charge must never repeat).
 *   4. In one transaction: marks the invoice PAID, lowers the balance, completes
 *      the payment and notifies the customer. If the invoice was paid by someone
 *      else in the meantime, this charge is refunded instead of counted twice.
 */
import { FieldValue, getFirestore, type DocumentSnapshot } from 'firebase-admin/firestore'
import { HttpError } from './http'
import {
  balanceAfterPayment,
  cardBrand,
  cardDigits,
  cardProblems,
  isPayable,
  manualReference,
  paymentIdFor,
  paymentNotAllowed,
  paymentNotification,
  type ChargeResult,
  type PaymentProvider,
  type PaymentRequest,
} from './payments'

export interface PaymentOutcome {
  paymentId: string
  status: 'SUCCESS' | 'FAILED'
  amount: number
  reference: string | null
  message: string
  invoiceId: string
  invoiceNumber: string
  /** True if this response repeats an earlier attempt (a retry). */
  repeated: boolean
}

function outcomeFrom(
  snap: DocumentSnapshot,
  invoiceNumber: string,
  repeated: boolean,
): PaymentOutcome {
  const p = snap.data()!
  const ok = p.status === 'SUCCESS'
  return {
    paymentId: snap.id,
    status: ok ? 'SUCCESS' : 'FAILED',
    amount: p.amount,
    reference: p.reference ?? null,
    message: ok
      ? 'Payment received. Thank you.'
      : (p.failureReason ?? 'The payment did not go through.'),
    invoiceId: p.invoiceId,
    invoiceNumber,
    repeated,
  }
}

export async function processPayment(
  request: PaymentRequest,
  caller: { uid: string; role: string },
  provider: PaymentProvider,
): Promise<PaymentOutcome> {
  const db = getFirestore()
  const invoiceRef = db.doc(`invoices/${request.invoiceId}`)
  const invoiceSnap = await invoiceRef.get()
  if (!invoiceSnap.exists) throw new HttpError(404, 'That invoice does not exist.')
  const invoice = invoiceSnap.data()!

  const refusal = paymentNotAllowed(caller, invoice.customerId, request.method)
  if (refusal) throw new HttpError(403, refusal)

  const paymentId = paymentIdFor(request.invoiceId, request.idempotencyKey)
  const paymentRef = db.doc(`payments/${paymentId}`)

  // A retry of an attempt we've already handled: report what happened, charge nothing.
  const earlier = await paymentRef.get()
  if (earlier.exists && earlier.get('status') !== 'PENDING')
    return outcomeFrom(earlier, invoice.invoiceNumber, true)
  if (earlier.exists)
    throw new HttpError(409, 'This payment is still being processed. Check your bills in a moment.')

  if (!isPayable(invoice.status)) throw new HttpError(409, 'This invoice is already paid.')
  if (request.method === 'CARD') {
    const problems = cardProblems(request.card!)
    if (problems) throw new HttpError(400, Object.values(problems)[0]!)
  }

  const amount: number = invoice.amount // never from the browser
  const card = request.card
  try {
    await paymentRef.create({
      invoiceId: request.invoiceId,
      accountId: invoice.accountId,
      customerId: invoice.customerId,
      amount,
      status: 'PENDING',
      paymentMethod: request.method,
      reference: null,
      provider: request.method === 'CARD' ? provider.name : 'MANUAL',
      cardBrand: card ? cardBrand(card.number) : null,
      cardLast4: card ? cardDigits(card.number).slice(-4) : null,
      recordedBy: caller.uid,
      failureReason: null,
      paidAt: null,
      createdAt: FieldValue.serverTimestamp(),
    })
  } catch (error) {
    // Two identical requests raced: the other one owns this attempt.
    if ((error as { code?: number }).code === 6)
      throw new HttpError(409, 'This payment is already being processed.')
    throw error
  }

  // ---- charge (outside any transaction)
  let charge: ChargeResult
  if (request.method === 'CARD') {
    try {
      charge = await provider.charge({ amount, paymentId, card: card! })
    } catch {
      charge = {
        ok: false,
        code: 'PROCESSING_ERROR',
        message: 'The payment provider could not be reached. You have not been charged. Try again.',
      }
    }
  } else {
    charge = { ok: true, reference: request.reference ?? manualReference(request.method) }
  }

  if (!charge.ok) {
    await paymentRef.update({ status: 'FAILED', failureReason: charge.message })
    return outcomeFrom(await paymentRef.get(), invoice.invoiceNumber, false)
  }

  // ---- settle (one transaction)
  const accountRef = db.doc(`accounts/${invoice.accountId}`)
  const settled = await db.runTransaction(async (tx) => {
    const [inv, account] = await Promise.all([tx.get(invoiceRef), tx.get(accountRef)])
    if (!isPayable(inv.get('status'))) {
      tx.update(paymentRef, {
        status: 'FAILED',
        reference: charge.reference,
        failureReason: 'This invoice was already paid, so this payment was cancelled and refunded.',
      })
      return false
    }
    tx.update(invoiceRef, { status: 'PAID', paidAt: FieldValue.serverTimestamp() })
    tx.update(accountRef, {
      balance: balanceAfterPayment(account.get('balance') ?? 0, amount),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(paymentRef, {
      status: 'SUCCESS',
      reference: charge.reference,
      paidAt: FieldValue.serverTimestamp(),
    })
    tx.set(db.doc(`notifications/payment-${paymentId}`), {
      ...paymentNotification({
        customerId: invoice.customerId,
        invoiceId: request.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount,
        reference: charge.reference,
      }),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
    return true
  })
  if (!settled && request.method === 'CARD') await provider.refund(charge.reference)

  return outcomeFrom(await paymentRef.get(), invoice.invoiceNumber, false)
}
