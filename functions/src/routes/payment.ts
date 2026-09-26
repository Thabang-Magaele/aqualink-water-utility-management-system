import { HttpError, sendSuccess, type Handler } from '../shared/http'
import { processPayment } from '../shared/paymentStore'
import { createMockProvider, parsePaymentRequest, type PaymentProvider } from '../shared/payments'

/**
 * The configured payment provider. Only the sandbox exists in the MVP; a real
 * gateway would be added here and selected with PAYMENT_PROVIDER in functions/.env
 * (its secret keys stored with `firebase functions:secrets:set`, never in code).
 */
function provider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? 'mock'
  if (name === 'mock') return createMockProvider({ delayMs: 800 })
  throw new HttpError(500, 'Payments are not configured. Contact an administrator.')
}

/**
 * POST /api/payment
 *   { invoiceId, method: 'CARD', idempotencyKey, card: { name, number, expiry, cvc } }
 *   { invoiceId, method: 'EFT' | 'CASH', idempotencyKey, reference? }   (billing / admin)
 *
 * Pays an invoice in full. A declined card is a normal outcome: the response is
 * 200 with status FAILED and the reason, so the page can show it.
 */
export const payment: Handler = async (req, res, caller) => {
  const request = parsePaymentRequest(req.body)
  if (typeof request === 'string') throw new HttpError(400, request)
  const outcome = await processPayment(request, caller, provider())
  sendSuccess(res, outcome.message, outcome)
}
