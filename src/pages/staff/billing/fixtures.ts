/** Test fixtures for the billing screens (fictional data). */
import type { Account, BillingSettings, Invoice } from '../../../types/models'
import type { BillingRun } from '../../../services/billingService'

export const ts = (iso: string) =>
  ({
    toDate: () => new Date(iso),
    toMillis: () => new Date(iso).getTime(),
  }) as unknown as Invoice['createdAt']

const now = new Date()
const thisMonth = new Date(now.getFullYear(), now.getMonth(), 2, 10).toISOString()

export const invoice = (id: string, o: Partial<Invoice> = {}): Invoice => ({
  id,
  invoiceNumber: `INV-202609-${id}`,
  accountId: 'a1',
  customerId: 'c1',
  billingPeriod: '2026-09',
  previousReading: 1330.4,
  currentReading: 1345.6,
  consumption: 15.2,
  tariffRate: 28.5,
  amount: 433.2,
  status: 'UNPAID',
  dueDate: ts('2026-10-16T10:00:00'),
  paidAt: null,
  createdAt: ts(thisMonth),
  ...o,
})

export const invoices: Invoice[] = [
  invoice('A1', { amount: 433.2 }),
  invoice('B2', {
    accountId: 'a3',
    customerId: 'c2',
    amount: 687.1,
    status: 'OVERDUE',
    dueDate: ts('2026-09-10T10:00:00'),
  }),
  invoice('C3', {
    amount: 404.7,
    status: 'PAID',
    paidAt: ts('2026-08-30T10:00:00'),
    createdAt: ts('2026-08-25T10:00:00'),
    billingPeriod: '2026-08',
  }),
]

export const account: Account = {
  id: 'a1',
  accountNumber: '4100223107',
  customerId: 'c1',
  meterId: 'm1',
  balance: 433.2,
  status: 'ACTIVE',
  propertyAddress: '14 Mahlangu Street, KaNyamazane',
  area: 'KaNyamazane',
  createdAt: ts('2024-01-10T10:00:00'),
  updatedAt: ts('2026-09-01T10:00:00'),
}

export const settings: BillingSettings = {
  tariffRate: 28.5,
  paymentTermsDays: 21,
  updatedAt: null,
  updatedBy: null,
}

export const previewRun: BillingRun = {
  dryRun: true,
  settings: { tariffRate: 28.5, paymentTermsDays: 21 },
  billableCount: 2,
  total: 1120.3,
  failed: [],
  accounts: [
    {
      ok: true,
      created: false,
      accountId: 'a1',
      accountNumber: '4100223107',
      customerName: 'Thandi Mokoena',
      invoiceId: 'a1_r5',
      invoiceNumber: 'INV-202609-4100223107',
      billingPeriod: '2026-09',
      previousReading: 1330.4,
      currentReading: 1345.6,
      consumption: 15.2,
      tariffRate: 28.5,
      amount: 433.2,
      dueDate: '2026-10-16T10:00:00.000Z',
    },
    {
      ok: true,
      created: false,
      accountId: 'a3',
      accountNumber: '4100231842',
      customerName: 'Sipho Dlamini',
      invoiceId: 'a3_r5',
      invoiceNumber: 'INV-202609-4100231842',
      billingPeriod: '2026-09',
      previousReading: 2000,
      currentReading: 2024.1,
      consumption: 24.1,
      tariffRate: 28.5,
      amount: 687.1,
      dueDate: '2026-10-16T10:00:00.000Z',
    },
    {
      ok: false,
      accountId: 'a2',
      accountNumber: '4100223115',
      customerName: 'Thandi Mokoena',
      reason: 'NOTHING_TO_BILL',
      message: 'No new consumption since the last invoice (1331.3 kL). Record a new reading first.',
    },
  ],
}
