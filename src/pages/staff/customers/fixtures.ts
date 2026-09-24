/** Test fixtures for the customer-management screens (fictional data). */
import type { Account, Customer, Invoice, Meter, Payment, Ticket } from '../../../types/models'

export const ts = (iso: string) =>
  ({ toDate: () => new Date(iso) }) as unknown as Customer['createdAt']

export const thandi = {
  id: 'c1',
  name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  phone: '0821234567',
  address: '14 Mahlangu Street, KaNyamazane',
  area: 'KaNyamazane',
  accountIds: ['a1', 'a2'],
  createdAt: ts('2025-08-01'),
  updatedAt: ts('2026-08-01'),
} as Customer

export const accounts: Account[] = [
  {
    id: 'a1',
    accountNumber: '4100223107',
    customerId: 'c1',
    meterId: 'm1',
    balance: 467.4,
    status: 'ACTIVE',
    propertyAddress: '14 Mahlangu Street, KaNyamazane',
    area: 'KaNyamazane',
    createdAt: ts('2025-08-01'),
    updatedAt: ts('2026-09-01'),
  },
  {
    id: 'a2',
    accountNumber: '4100223115',
    customerId: 'c1',
    meterId: null,
    balance: 0,
    status: 'SUSPENDED',
    propertyAddress: '3 Protea Close, Tekwane',
    area: 'Tekwane',
    createdAt: ts('2025-08-01'),
    updatedAt: ts('2026-09-01'),
  },
]

export const meters: Meter[] = [
  {
    id: 'm1',
    meterNumber: 'MTR-223107',
    accountId: 'a1',
    customerId: 'c1',
    installationDate: ts('2024-01-01'),
    status: 'ACTIVE',
    lastReading: 1331.3,
    lastReadingDate: ts('2026-08-25'),
    createdAt: ts('2024-01-01'),
    updatedAt: ts('2026-08-25'),
  },
]

export const invoices: Invoice[] = [
  {
    id: 'i1',
    invoiceNumber: 'INV-202608-3107',
    accountId: 'a1',
    customerId: 'c1',
    billingPeriod: '2026-08',
    previousReading: 1314.9,
    currentReading: 1331.3,
    consumption: 16.4,
    tariffRate: 28.5,
    amount: 467.4,
    status: 'UNPAID',
    dueDate: ts('2026-10-03'),
    paidAt: null,
    createdAt: ts('2026-08-25'),
  },
]

export const payments: Payment[] = [
  {
    id: 'p1',
    invoiceId: 'i0',
    accountId: 'a1',
    customerId: 'c1',
    amount: 404.7,
    status: 'SUCCESS',
    paymentMethod: 'CARD',
    reference: 'MOCK-1071X7K',
    provider: 'MOCK',
    paidAt: ts('2026-08-10'),
    createdAt: ts('2026-08-10'),
  },
]

export const tickets: Ticket[] = [
  {
    id: 't1',
    ticketNumber: 'TKT-260923-A7K2',
    customerId: 'c1',
    accountId: 'a1',
    assetId: null,
    type: 'LEAK',
    description: 'Leak at gate',
    priority: 'MEDIUM',
    status: 'OPEN',
    location: '14 Mahlangu Street, KaNyamazane',
    area: 'KaNyamazane',
    customerName: 'Thandi Mokoena',
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    createdBy: 'c1',
    createdAt: ts('2026-09-23'),
    updatedAt: ts('2026-09-23'),
    resolvedAt: null,
  },
  {
    id: 't2',
    ticketNumber: 'TKT-260917-R8WD',
    customerId: 'c1',
    accountId: 'a2',
    assetId: null,
    type: 'NO_WATER',
    description: 'No water',
    priority: 'HIGH',
    status: 'RESOLVED',
    location: '3 Protea Close, Tekwane',
    area: 'Tekwane',
    customerName: 'Thandi Mokoena',
    assignedTechnicianId: 'tech1',
    assignedTechnicianName: 'Bongani Dube',
    createdBy: 'c1',
    createdAt: ts('2026-09-17'),
    updatedAt: ts('2026-09-18'),
    resolvedAt: ts('2026-09-18'),
  },
]
