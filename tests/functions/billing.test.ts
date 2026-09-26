import { describe, expect, it } from 'vitest'
import * as client from '../../src/utils/domain'
import {
  billingPeriodOf,
  calculateConsumption,
  DEFAULT_BILLING,
  invoiceNotification,
  isValidSettings,
  overdueInvoices,
  planInvoice,
  roundMoney,
  type PlanInput,
} from '../../functions/src/shared/billing'

const now = new Date('2026-09-25T10:00:00Z')
const at = (iso: string) => new Date(iso)
const base: PlanInput = {
  account: {
    id: 'acc-1',
    accountNumber: '4100223107',
    customerId: 'c1',
    status: 'ACTIVE',
    meterId: 'm1',
    balance: 467.4,
  },
  readings: [
    { id: 'r1', value: 1314.2, date: at('2026-07-25T08:00:00Z') },
    { id: 'r3', value: 1345.6, date: at('2026-09-24T08:00:00Z') },
    { id: 'r2', value: 1330.4, date: at('2026-08-25T08:00:00Z') },
  ],
  lastInvoicedReading: 1330.4,
  invoicesInPeriod: 0,
  settings: DEFAULT_BILLING,
  now,
}

describe('planInvoice', () => {
  it('bills the use since the last invoice at the tariff', () => {
    const plan = planInvoice(base)
    expect(plan).toMatchObject({
      ok: true,
      invoiceId: 'acc-1_r3',
      invoiceNumber: 'INV-202609-4100223107',
      billingPeriod: '2026-09',
      previousReading: 1330.4,
      currentReading: 1345.6,
      consumption: 15.2,
      tariffRate: 28.5,
      amount: 433.2,
      newBalance: 900.6,
    })
    if (plan.ok) expect(plan.dueDate.toISOString()).toBe('2026-10-16T10:00:00.000Z') // 21 days
  })

  it('uses the configured tariff and payment terms', () => {
    const plan = planInvoice({ ...base, settings: { tariffRate: 31.75, paymentTermsDays: 30 } })
    expect(plan.ok && plan.amount).toBe(482.6) // 15.2 × 31.75
    expect(plan.ok && plan.dueDate.toISOString()).toBe('2026-10-25T10:00:00.000Z')
  })

  it('bills from the installation reading when the account has never been billed', () => {
    const plan = planInvoice({ ...base, lastInvoicedReading: null })
    expect(plan).toMatchObject({
      ok: true,
      previousReading: 1314.2,
      consumption: 31.4,
      amount: 894.9,
    })
  })

  it('numbers a second invoice in the same month without clashing', () => {
    expect(planInvoice({ ...base, invoicesInPeriod: 1 })).toMatchObject({
      invoiceNumber: 'INV-202609-4100223107-2',
    })
  })

  it('refuses to bill twice for the same reading', () => {
    expect(planInvoice({ ...base, lastInvoicedReading: 1345.6 })).toMatchObject({
      ok: false,
      reason: 'NOTHING_TO_BILL',
    })
  })

  it('explains why other accounts are skipped', () => {
    expect(
      planInvoice({ ...base, account: { ...base.account, status: 'SUSPENDED' } }),
    ).toMatchObject({ reason: 'ACCOUNT_NOT_ACTIVE', message: 'Account is suspended.' })
    expect(planInvoice({ ...base, account: { ...base.account, meterId: null } })).toMatchObject({
      reason: 'NO_METER',
    })
    expect(planInvoice({ ...base, readings: [] })).toMatchObject({ reason: 'NO_READINGS' })
    expect(
      planInvoice({ ...base, readings: [base.readings[0]], lastInvoicedReading: null }),
    ).toMatchObject({
      reason: 'NOTHING_TO_BILL',
      message: expect.stringMatching(/Only the installation reading/),
    })
  })
})

describe('billing periods use South African time', () => {
  it('a reading at 00:30 on 1 October in Mbombela is October, even though it is still September in UTC', () => {
    expect(billingPeriodOf(at('2026-09-30T22:30:00Z'))).toBe('2026-10')
    expect(billingPeriodOf(at('2026-09-30T21:30:00Z'))).toBe('2026-09')
  })
})

describe('overdueInvoices', () => {
  it('selects unpaid invoices past their due date only', () => {
    const invoices = [
      { id: 'a', status: 'UNPAID', dueDate: at('2026-09-20T00:00:00Z') },
      { id: 'b', status: 'UNPAID', dueDate: at('2026-10-01T00:00:00Z') },
      { id: 'c', status: 'PAID', dueDate: at('2026-09-01T00:00:00Z') },
      { id: 'd', status: 'OVERDUE', dueDate: at('2026-09-01T00:00:00Z') },
    ]
    expect(overdueInvoices(invoices, now).map((i) => i.id)).toEqual(['a'])
  })
})

describe('settings', () => {
  it('accepts sensible values and rejects the rest', () => {
    expect(isValidSettings(DEFAULT_BILLING)).toBe(true)
    expect(isValidSettings({ tariffRate: 0, paymentTermsDays: 21 })).toBe(false)
    expect(isValidSettings({ tariffRate: 28.5, paymentTermsDays: 2.5 })).toBe(false)
    expect(isValidSettings({ tariffRate: 28.5, paymentTermsDays: 120 })).toBe(false)
    expect(isValidSettings(null)).toBe(false)
  })
})

describe('notifications', () => {
  const invoice = {
    id: 'acc-1_r3',
    customerId: 'c1',
    invoiceNumber: 'INV-202609-4100223107',
    amount: 433.2,
    dueDate: at('2026-10-16T10:00:00Z'),
  }
  it('tells the customer about a new invoice, linking to it', () => {
    const n = invoiceNotification('issued', invoice)
    expect(n).toMatchObject({
      userId: 'c1',
      type: 'BILLING',
      relatedId: 'acc-1_r3',
      link: '/customer/bills/acc-1_r3',
      title: 'New invoice',
    })
    expect(n.message).toMatch(/INV-202609-4100223107 for R\s?433[,.]20 is due on 16 October 2026/)
  })
  it('and when it becomes overdue', () => {
    expect(invoiceNotification('overdue', invoice).title).toBe('Invoice overdue')
  })
})

describe('server and browser agree on the maths', () => {
  it.each([
    [1330.4, 1345.6],
    [1300, 1314.2],
    [0, 0.1],
    [999.9, 1000],
    [1500, 1400],
  ])('consumption %s → %s', (prev, cur) => {
    expect(calculateConsumption(prev, cur)).toBe(client.calculateConsumption(prev, cur))
  })
  it.each([404.69999999999993, 0.005, 1.005, 433.2, -12.345])('roundMoney(%s)', (amount) => {
    expect(roundMoney(amount)).toBe(client.roundMoney(amount))
  })
})
