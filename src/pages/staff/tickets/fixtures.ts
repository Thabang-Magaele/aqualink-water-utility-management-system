/** Test fixtures for the ticket screens (fictional data). */
import type { Account, Ticket, TicketHistoryEntry } from '../../../types/models'

export const ts = (iso: string) =>
  ({ toDate: () => new Date(iso) }) as unknown as Ticket['createdAt']

export const openTicket: Ticket = {
  id: 't1',
  ticketNumber: 'TKT-260924-A7K2',
  customerId: 'custA',
  accountId: 'a1',
  assetId: null,
  type: 'LEAK',
  description: 'Water bubbling through the tar outside the gate.',
  priority: 'MEDIUM',
  status: 'OPEN',
  location: '14 Mahlangu Street',
  area: 'KaNyamazane',
  customerName: 'Thandi Mokoena',
  assignedTechnicianId: null,
  assignedTechnicianName: null,
  createdBy: 'custA',
  createdAt: ts('2026-09-24T08:00:00'),
  updatedAt: ts('2026-09-24T08:00:00'),
  resolvedAt: null,
}
export const inProgress: Ticket = {
  ...openTicket,
  id: 't2',
  ticketNumber: 'TKT-260923-M3QP',
  type: 'BURST_PIPE',
  priority: 'CRITICAL',
  status: 'IN_PROGRESS',
  customerId: 'c2',
  customerName: 'Sipho Dlamini',
  location: 'Jacaranda Avenue',
  area: 'White River',
  assignedTechnicianId: 'tech1',
  assignedTechnicianName: 'Bongani Dube',
  createdAt: ts('2026-09-23T14:00:00'),
}
export const resolved: Ticket = {
  ...openTicket,
  id: 't3',
  ticketNumber: 'TKT-260918-R8WD',
  type: 'NO_WATER',
  priority: 'HIGH',
  status: 'RESOLVED',
  assignedTechnicianId: 'tech1',
  assignedTechnicianName: 'Bongani Dube',
  resolvedAt: ts('2026-09-19T16:00:00'),
  createdAt: ts('2026-09-18T07:00:00'),
}

export const history: TicketHistoryEntry[] = [
  {
    id: 'h1',
    fromStatus: null,
    toStatus: 'OPEN',
    note: 'Reported via the customer portal.',
    changedBy: 'custA',
    changedByName: 'Thandi Mokoena',
    createdAt: ts('2026-09-24T08:00:00'),
  },
]

export const accounts = [
  {
    id: 'a1',
    accountNumber: '4100223107',
    customerId: 'custA',
    meterId: 'm1',
    balance: 0,
    status: 'ACTIVE',
    propertyAddress: '14 Mahlangu Street, KaNyamazane',
    area: 'KaNyamazane',
  },
  {
    id: 'a2',
    accountNumber: '4100223115',
    customerId: 'custA',
    meterId: null,
    balance: 0,
    status: 'ACTIVE',
    propertyAddress: '3 Protea Close, Tekwane',
    area: 'Tekwane',
  },
] as unknown as Account[]
