import { describe, expect, it } from 'vitest'
import {
  balanceAfterPayment,
  cardBrand,
  cardProblems,
  createMockProvider,
  expiryValid,
  isPayable,
  luhnValid,
  manualReference,
  parsePaymentRequest,
  paymentIdFor,
  paymentNotAllowed,
  paymentNotification,
  TEST_CARDS,
} from '../../functions/src/shared/payments'

const now = new Date(2026, 8, 25)
const card = (number: string = TEST_CARDS.SUCCESS) => ({
  name: 'T Mokoena',
  number,
  expiry: '12/28',
  cvc: '123',
})

describe('card checks', () => {
  it('accepts the test cards and rejects typos (Luhn)', () => {
    for (const n of Object.values(TEST_CARDS)) expect(luhnValid(n)).toBe(true)
    expect(luhnValid('4242 4242 4242 4241')).toBe(false)
    expect(luhnValid('1234')).toBe(false)
    expect(luhnValid('4242-4242-4242-4242')).toBe(true)
  })
  it('recognises card brands', () => {
    expect(cardBrand('4242424242424242')).toBe('Visa')
    expect(cardBrand('5555 5555 5555 4444')).toBe('Mastercard')
    expect(cardBrand('3782 822463 10005')).toBe('American Express')
  })
  it('treats a card as valid until the end of its expiry month', () => {
    expect(expiryValid('09/26', now)).toBe(true)
    expect(expiryValid('08/26', now)).toBe(false)
    expect(expiryValid('13/27', now)).toBe(false)
    expect(expiryValid('0927', now)).toBe(false)
  })
  it('reports each problem field', () => {
    expect(cardProblems(card(), now)).toBeNull()
    expect(cardProblems({ name: '', number: '4242', expiry: '01/20', cvc: '1' }, now)).toEqual({
      name: expect.any(String),
      number: expect.any(String),
      expiry: expect.any(String),
      cvc: expect.any(String),
    })
  })
})

describe('mock provider', () => {
  const provider = createMockProvider({ random: () => 0 })
  const charge = (number: string) =>
    provider.charge({ amount: 433.2, paymentId: 'p1', card: card(number) })
  it('succeeds with a MOCK reference', async () => {
    expect(await charge(TEST_CARDS.SUCCESS)).toEqual({ ok: true, reference: 'MOCK-22222222' })
    expect((await charge('5555 5555 5555 4444')).ok).toBe(true)
  })
  it('declines, reports insufficient funds, or simulates a provider outage on the test cards', async () => {
    expect(await charge(TEST_CARDS.DECLINED)).toMatchObject({ ok: false, code: 'CARD_DECLINED' })
    expect(await charge(TEST_CARDS.INSUFFICIENT_FUNDS)).toMatchObject({
      ok: false,
      code: 'INSUFFICIENT_FUNDS',
    })
    expect(await charge(TEST_CARDS.PROVIDER_ERROR)).toMatchObject({
      ok: false,
      code: 'PROCESSING_ERROR',
    })
  })
})

describe('parsePaymentRequest', () => {
  const base = { invoiceId: 'a3_r5', idempotencyKey: 'k-12345678' }
  it('accepts a card payment', () => {
    expect(parsePaymentRequest({ ...base, method: 'CARD', card: card() })).toMatchObject({
      method: 'CARD',
      invoiceId: 'a3_r5',
    })
  })
  it('rejects missing or malformed fields', () => {
    expect(typeof parsePaymentRequest({ ...base, method: 'CARD' })).toBe('string')
    expect(typeof parsePaymentRequest({ ...base, method: 'BITCOIN' })).toBe('string')
    expect(typeof parsePaymentRequest({ ...base, idempotencyKey: 'x', method: 'CASH' })).toBe(
      'string',
    )
    expect(typeof parsePaymentRequest(null)).toBe('string')
  })
  it('requires a bank reference for EFT but not for cash', () => {
    expect(typeof parsePaymentRequest({ ...base, method: 'EFT' })).toBe('string')
    expect(
      parsePaymentRequest({ ...base, method: 'EFT', reference: ' FNB 4100223107 ' }),
    ).toMatchObject({ reference: 'FNB 4100223107' })
    expect(parsePaymentRequest({ ...base, method: 'CASH' })).toMatchObject({
      method: 'CASH',
      reference: undefined,
    })
  })
  it('never accepts an amount from the browser', () => {
    const parsed = parsePaymentRequest({ ...base, method: 'CARD', card: card(), amount: 0.01 })
    expect(parsed).not.toHaveProperty('amount')
  })
})

describe('who may pay', () => {
  it('lets customers pay only their own invoices, by card', () => {
    expect(paymentNotAllowed({ uid: 'c1', role: 'customer' }, 'c1', 'CARD')).toBeNull()
    expect(paymentNotAllowed({ uid: 'c1', role: 'customer' }, 'c2', 'CARD')).toMatch(/own invoices/)
    expect(paymentNotAllowed({ uid: 'c1', role: 'customer' }, 'c1', 'CASH')).toMatch(
      /billing staff/,
    )
  })
  it('lets billing and admin take any payment, and refuses other staff', () => {
    expect(paymentNotAllowed({ uid: 'b', role: 'billing' }, 'c1', 'EFT')).toBeNull()
    expect(paymentNotAllowed({ uid: 'a', role: 'admin' }, 'c1', 'CARD')).toBeNull()
    expect(paymentNotAllowed({ uid: 't', role: 'technician' }, 'c1', 'CARD')).toMatch(/permission/)
    expect(paymentNotAllowed({ uid: 'x', role: 'call_centre' }, 'c1', 'CASH')).toMatch(/permission/)
  })
  it('only unpaid or overdue invoices can be paid', () => {
    expect(isPayable('UNPAID')).toBe(true)
    expect(isPayable('OVERDUE')).toBe(true)
    expect(isPayable('PAID')).toBe(false)
  })
})

describe('bookkeeping', () => {
  it('uses one document per payment attempt', () => {
    expect(paymentIdFor('a3_r5', 'k-12345678')).toBe('a3_r5_k-12345678')
  })
  it('reduces the balance to the cent', () => {
    expect(balanceAfterPayment(1120.3, 433.2)).toBe(687.1)
    expect(balanceAfterPayment(0.3, 0.1)).toBe(0.2)
  })
  it('makes receipt numbers for cash and EFT', () => {
    expect(manualReference('CASH', () => 0)).toBe('CASH-222222')
  })
  it('tells the customer their payment arrived', () => {
    expect(
      paymentNotification({
        customerId: 'c1',
        invoiceId: 'i1',
        invoiceNumber: 'INV-202609-4100223107',
        amount: 433.2,
        reference: 'MOCK-22222222',
      }),
    ).toMatchObject({
      userId: 'c1',
      type: 'PAYMENT',
      link: '/customer/bills/i1',
      title: 'Payment received',
    })
  })
})

// ------------------------------------------------ browser and server must agree
import * as browser from '../../src/utils/card'
import * as server from '../../functions/src/shared/payments'

describe('browser and server card checks agree', () => {
  const numbers = [
    '4242 4242 4242 4242',
    '4242424242424241',
    '5555555555554444',
    '4000 0000 0000 0002',
    '1234',
    '4'.repeat(20),
    '',
  ]
  const expiries = ['01/26', '09/26', '10/26', '12/99', '13/27', '0927', '9/27', '']
  it.each(numbers)('Luhn: %s', (n) => {
    expect(browser.luhnValid(n)).toBe(server.luhnValid(n))
  })
  it.each(expiries)('expiry: %s', (e) => {
    expect(browser.expiryValid(e, now)).toBe(server.expiryValid(e, now))
  })
  it('test cards match', () => {
    expect(browser.TEST_CARDS.map((c) => c.number)).toEqual(Object.values(server.TEST_CARDS))
  })
})
