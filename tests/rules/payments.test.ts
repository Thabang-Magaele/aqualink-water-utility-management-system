/**
 * Payments, end to end against the Firestore emulator:
 *  - the real server code (functions/src/shared/paymentStore.ts) with a test provider
 *  - the security rules for the customer's payment queries (src/services/billingQueries.ts)
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
// The functions' own firebase-admin copy, the one paymentStore.ts uses (see adminApp.ts)
import {
  getApps,
  getFirestore as adminDb,
  initializeApp,
} from '../../functions/src/shared/adminApp'
import { addDoc, collection, getDocs, type Firestore } from 'firebase/firestore'
import { buildSampleData } from '../../scripts/sample-data'
import { billingQueries } from '../../src/services/billingQueries'
import { HttpError } from '../../functions/src/shared/http'
import { processPayment } from '../../functions/src/shared/paymentStore'
import {
  createMockProvider,
  TEST_CARDS,
  type PaymentProvider,
} from '../../functions/src/shared/payments'

let env: RulesTestEnvironment
const CUSTOMER = 'custA'
const customer = { uid: CUSTOMER, role: 'customer' }
const billing = { uid: 'bill1', role: 'billing' }
const unpaid = buildSampleData({ customerUid: CUSTOMER }).find(
  (d) => d.path.startsWith('invoices/sample-inv-acc-1') && d.data.status === 'UNPAID',
)!
const INVOICE = unpaid.path.split('/')[1]
const AMOUNT = unpaid.data.amount as number
const card = (number: string = TEST_CARDS.SUCCESS) => ({
  name: 'T Mokoena',
  number,
  expiry: '12/30',
  cvc: '123',
})
const cardRequest = (key: string, number?: string) => ({
  invoiceId: INVOICE,
  method: 'CARD' as const,
  idempotencyKey: key,
  card: card(number),
})

/** Counts charges and refunds so tests can prove nothing is charged twice. */
function countingProvider(): PaymentProvider & { charges: number; refunds: number } {
  const inner = createMockProvider()
  const p = {
    name: 'MOCK',
    charges: 0,
    refunds: 0,
    async charge(r: Parameters<PaymentProvider['charge']>[0]) {
      p.charges++
      return inner.charge(r)
    },
    async refund() {
      p.refunds++
    },
  }
  return p
}

const read = async (path: string) => (await adminDb().doc(path).get()).data()!
const paymentsFor = async (invoiceId: string) =>
  (await adminDb().collection('payments').where('invoiceId', '==', invoiceId).get()).docs

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aqualink',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  if (!getApps().length) initializeApp({ projectId: 'demo-aqualink' }) // uses FIRESTORE_EMULATOR_HOST
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const batch = db.batch()
    for (const d of buildSampleData({
      customerUid: CUSTOMER,
      technicianUid: 'tech1',
      staffUid: 'admin1',
    }))
      batch.set(db.doc(d.path), d.data)
    await batch.commit()
  })
})

after(async () => {
  await env?.cleanup()
})

describe('Paying by card (server code, real Firestore)', () => {
  test('success: invoice PAID, balance down, payment recorded, customer notified, card number never stored', async () => {
    const before = (await read('accounts/sample-acc-1')).balance
    const provider = countingProvider()
    const outcome = await processPayment(cardRequest('attempt-00000001'), customer, provider)
    assert.equal(outcome.status, 'SUCCESS')
    assert.equal(outcome.amount, AMOUNT)
    assert.match(outcome.reference!, /^MOCK-/)

    const invoice = await read(`invoices/${INVOICE}`)
    assert.equal(invoice.status, 'PAID')
    assert.ok(invoice.paidAt)
    assert.equal(
      (await read('accounts/sample-acc-1')).balance,
      Math.round((before - AMOUNT) * 100) / 100,
    )

    const [payment] = await paymentsFor(INVOICE)
    assert.equal(payment.get('status'), 'SUCCESS')
    assert.equal(payment.get('cardLast4'), '4242')
    assert.ok(
      !JSON.stringify(payment.data()).includes('4242424242424242'),
      'full card number must not be stored',
    )
    assert.equal((await read(`notifications/payment-${payment.id}`)).title, 'Payment received')
    assert.equal(provider.charges, 1)
  })

  test('a retry with the same attempt key returns the first result and charges nothing more', async () => {
    const provider = countingProvider()
    const first = await processPayment(cardRequest('attempt-00000002'), customer, provider)
    const balance = (await read('accounts/sample-acc-1')).balance
    const again = await processPayment(cardRequest('attempt-00000002'), customer, provider)
    assert.equal(again.repeated, true)
    assert.equal(again.reference, first.reference)
    assert.equal(provider.charges, 1)
    assert.equal((await paymentsFor(INVOICE)).length, 1)
    assert.equal((await read('accounts/sample-acc-1')).balance, balance)
  })

  test('a declined card changes nothing but the attempt; a new attempt can then succeed', async () => {
    const before = (await read('accounts/sample-acc-1')).balance
    const declined = await processPayment(
      cardRequest('attempt-00000003', TEST_CARDS.DECLINED),
      customer,
      countingProvider(),
    )
    assert.equal(declined.status, 'FAILED')
    assert.match(declined.message, /declined/)
    assert.equal((await read(`invoices/${INVOICE}`)).status, 'UNPAID')
    assert.equal((await read('accounts/sample-acc-1')).balance, before)
    const ok = await processPayment(cardRequest('attempt-00000004'), customer, countingProvider())
    assert.equal(ok.status, 'SUCCESS')
  })

  test('if the provider fails outright, the customer is told they were not charged', async () => {
    const broken: PaymentProvider = {
      name: 'MOCK',
      charge: async () => {
        throw new Error('timeout')
      },
      refund: async () => {},
    }
    const outcome = await processPayment(cardRequest('attempt-00000005'), customer, broken)
    assert.equal(outcome.status, 'FAILED')
    assert.match(outcome.message, /not been charged/)
    assert.equal((await read(`invoices/${INVOICE}`)).status, 'UNPAID')
  })

  test('two simultaneous payments on one invoice: exactly one succeeds, the other is refunded', async () => {
    const provider = countingProvider()
    const results = await Promise.all([
      processPayment(cardRequest('attempt-0000000A'), customer, provider),
      processPayment(cardRequest('attempt-0000000B'), billing, provider),
    ])
    const statuses = results.map((r) => r.status).sort()
    // Either both got through the "is it payable?" check (one charged then refunded),
    // or the second saw the invoice already paid and was refused before charging.
    assert.ok(statuses[1] === 'SUCCESS')
    assert.equal(results.filter((r) => r.status === 'SUCCESS').length, 1)
    assert.equal(
      provider.charges - provider.refunds,
      1,
      'the customer ends up charged exactly once',
    )
    const before = buildSampleData({ customerUid: CUSTOMER }).find(
      (d) => d.path === 'accounts/sample-acc-1',
    )!.data.balance as number
    assert.equal(
      (await read('accounts/sample-acc-1')).balance,
      Math.round((before - AMOUNT) * 100) / 100,
    )
  })
})

describe('Refused payments', () => {
  const rejects = (promise: Promise<unknown>, status: number) =>
    assert.rejects(promise, (e: unknown) => e instanceof HttpError && e.status === status)

  test("a customer can't pay someone else's invoice", async () => {
    await rejects(
      processPayment(
        cardRequest('attempt-00000006'),
        { uid: 'sample-cust-2', role: 'customer' },
        countingProvider(),
      ),
      403,
    )
  })
  test("a customer can't record cash, and a technician can't take payments", async () => {
    await rejects(
      processPayment(
        { invoiceId: INVOICE, method: 'CASH', idempotencyKey: 'attempt-00000007' },
        customer,
        countingProvider(),
      ),
      403,
    )
    await rejects(
      processPayment(
        cardRequest('attempt-00000008'),
        { uid: 'tech1', role: 'technician' },
        countingProvider(),
      ),
      403,
    )
  })
  test('an invoice that is already paid is refused before any charge', async () => {
    const provider = countingProvider()
    await processPayment(cardRequest('attempt-00000009'), customer, provider)
    await rejects(processPayment(cardRequest('attempt-00000010'), customer, provider), 409)
    assert.equal(provider.charges, 1)
  })
  test('an unknown invoice is a 404', async () => {
    await rejects(
      processPayment(
        { ...cardRequest('attempt-00000011'), invoiceId: 'nope' },
        customer,
        countingProvider(),
      ),
      404,
    )
  })
})

describe('Billing records EFT and cash', () => {
  test('EFT keeps the bank reference; cash without one gets a receipt number', async () => {
    const eft = await processPayment(
      {
        invoiceId: INVOICE,
        method: 'EFT',
        idempotencyKey: 'attempt-00000012',
        reference: 'FNB 4100223107',
      },
      billing,
      countingProvider(),
    )
    assert.equal(eft.status, 'SUCCESS')
    assert.equal(eft.reference, 'FNB 4100223107')
    const other = buildSampleData({ customerUid: CUSTOMER }).find(
      (d) => d.path.startsWith('invoices/sample-inv-acc-3') && d.data.status === 'UNPAID',
    )!
    const cash = await processPayment(
      { invoiceId: other.path.split('/')[1], method: 'CASH', idempotencyKey: 'attempt-00000013' },
      billing,
      countingProvider(),
    )
    assert.match(cash.reference!, /^CASH-/)
  })
})

describe('Rules: the Bills and invoice pages’ payment queries', () => {
  const as = (uid: string, role?: string) =>
    env
      .authenticatedContext(uid, { email: `${uid}@aqualink.demo`, ...(role ? { role } : {}) })
      .firestore() as unknown as Firestore
  test('a customer reads their own payments, with their ID in the query', async () => {
    await assertSucceeds(getDocs(billingQueries.customerPayments(as(CUSTOMER), CUSTOMER)))
    await assertSucceeds(getDocs(billingQueries.invoicePayments(as(CUSTOMER), INVOICE, CUSTOMER)))
  })
  test("without their ID the rules can't prove ownership, so it's refused; so are other customers' payments", async () => {
    await assertFails(getDocs(billingQueries.invoicePayments(as(CUSTOMER), INVOICE)))
    await assertFails(getDocs(billingQueries.customerPayments(as(CUSTOMER), 'sample-cust-2')))
  })
  test('billing reads any invoice’s payments; nobody writes payments from the browser', async () => {
    await assertSucceeds(getDocs(billingQueries.invoicePayments(as('bill1', 'billing'), INVOICE)))
    await assertFails(
      addDoc(collection(as(CUSTOMER), 'payments'), {
        invoiceId: INVOICE,
        customerId: CUSTOMER,
        amount: AMOUNT,
        status: 'SUCCESS',
      }),
    )
  })
})
