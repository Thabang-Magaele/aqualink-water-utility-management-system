/**
 * Builds a small, fully linked sample dataset covering every collection.
 * Pure function: no Firebase calls, so it can be checked without a database.
 * All people, addresses and numbers are fictional.
 *
 * Phase 20 extends this into the full demo dataset (20–50 customers).
 */
import type { Timestamp } from 'firebase/firestore'
import type {
  Account,
  BillingSettings,
  Asset,
  AuditLog,
  Customer,
  Invoice,
  Meter,
  Notification,
  OutageNotice,
  Payment,
  Reading,
  Ticket,
  TicketHistoryEntry,
  WaterQualityTest,
} from '../src/types/models'
import { WATER_QUALITY_PARAMETERS, type WaterQualityParameter } from '../src/types/models'
import {
  billingPeriodOf,
  calculateConsumption,
  evaluateWaterQuality,
  roundMoney,
} from '../src/utils/domain'

/** Model shape for writing with the Admin SDK: no `id`, JS Dates instead of Timestamps. */
export type Seed<T> = {
  [K in keyof T as K extends 'id' ? never : K]: T[K] extends Timestamp
    ? Date
    : T[K] extends Timestamp | null
      ? Date | null
      : T[K]
}

export interface SeedDoc {
  path: string
  data: Record<string, unknown>
}

export interface SampleIds {
  /** Auth uid of customer@aqualink.demo, if that account exists. */
  customerUid?: string
  technicianUid?: string
  technicianName?: string
  staffUid?: string
}

/** Simplified flat tariff for the sample data (rand per kL). Phase 10 makes this configurable. */
export const SAMPLE_TARIFF = 28.5

export function buildSampleData(ids: SampleIds = {}, now = new Date()): SeedDoc[] {
  const docs: SeedDoc[] = []
  const put = <T>(path: string, data: Seed<T>) =>
    docs.push({ path, data: data as Record<string, unknown> })

  const day = 86_400_000
  // "Today" events happen at up to 09:00. Before 10:00 the timeline is anchored on
  // yesterday, so nothing is dated in the future and the order of events is kept.
  const anchor = now.getHours() < 10 ? new Date(now.getTime() - day) : now
  const daysAgo = (n: number, hour = 9) => {
    const d = new Date(anchor.getTime() - n * day)
    d.setHours(hour, 0, 0, 0)
    return d
  }
  /** Meter-reading day: the 25th, counting back from the most recent 25th that has already passed. */
  // This month's reading day only counts once it has actually happened (25th, 10:00);
  // otherwise the newest reading would be dated in the future.
  const lastReadMonthOffset = new Date(now.getFullYear(), now.getMonth(), 25, 10) <= now ? 0 : 1
  const monthDay = (monthsAgo: number) =>
    new Date(now.getFullYear(), now.getMonth() - monthsAgo - lastReadMonthOffset, 25, 10)

  const technicianId = ids.technicianUid ?? 'sample-technician'
  const technicianName = ids.technicianName ?? 'Bongani Dube'
  const staffId = ids.staffUid ?? 'seed-script'

  // -- Customers and accounts ------------------------------------------------
  const customers = [
    {
      id: ids.customerUid ?? 'sample-cust-1',
      name: 'Thandi Mokoena',
      email: 'customer@aqualink.demo',
      phone: '0821234567',
      address: '14 Mahlangu Street, KaNyamazane',
      area: 'KaNyamazane' as const,
      accounts: [
        {
          key: 'acc-1',
          number: '4100223107',
          address: '14 Mahlangu Street, KaNyamazane',
          monthly: [14.2, 15.8, 13.9, 16.4],
        },
        {
          key: 'acc-2',
          number: '4100223115',
          address: '3 Protea Close, Tekwane',
          monthly: [8.1, 7.6, 9.3, 8.8],
        },
      ],
    },
    {
      id: 'sample-cust-2',
      name: 'Sipho Dlamini',
      email: 'sipho.dlamini@example.com',
      phone: '0739876543',
      address: '27 Jacaranda Avenue, White River',
      area: 'White River' as const,
      accounts: [
        {
          key: 'acc-3',
          number: '4100231842',
          address: '27 Jacaranda Avenue, White River',
          monthly: [22.5, 24.1, 21.7, 25.9],
        },
      ],
    },
    {
      id: 'sample-cust-3',
      name: 'Anele Khumalo',
      email: 'anele.khumalo@example.com',
      phone: '0614455667',
      address: '9 Marula Road, Matsulu',
      area: 'Matsulu' as const,
      accounts: [
        {
          key: 'acc-4',
          number: '4100245569',
          address: '9 Marula Road, Matsulu',
          monthly: [11.0, 12.6, 10.4, 11.9],
        },
      ],
    },
  ]

  const invoicesForNotifications: {
    id: string
    number: string
    amount: number
    customerId: string
  }[] = []

  customers.forEach((c) => {
    put<Customer>(`customers/${c.id}`, {
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      area: c.area,
      accountIds: c.accounts.map((a) => `sample-${a.key}`),
      createdAt: daysAgo(400),
      updatedAt: daysAgo(30),
    })

    c.accounts.forEach((a, accIndex) => {
      const accountId = `sample-${a.key}`
      const meterId = `sample-meter-${a.key.split('-')[1]}`

      // Four monthly readings, cumulative: start value + running total of monthly use.
      let value = 1200 + accIndex * 350 + a.number.length * 10
      const readings = [{ date: monthDay(4), value }]
      a.monthly.forEach((used, i) => {
        value = Math.round((value + used) * 10) / 10
        readings.push({ date: monthDay(3 - i), value })
      })
      readings.forEach((r, i) =>
        put<Reading>(`readings/sample-${a.key}-r${i}`, {
          meterId,
          accountId,
          customerId: c.id,
          readingValue: r.value,
          readingDate: r.date,
          recordedBy: staffId,
          createdAt: r.date,
        }),
      )
      const last = readings[readings.length - 1]

      put<Meter>(`meters/${meterId}`, {
        meterNumber: `MTR-${a.number.slice(-6)}`,
        accountId,
        customerId: c.id,
        installationDate: daysAgo(900),
        status: 'ACTIVE',
        lastReading: last.value,
        lastReadingDate: last.date,
        createdAt: daysAgo(900),
        updatedAt: last.date,
      })

      // One invoice per month between readings. Older ones paid; newest unpaid (or overdue);
      // the middle one is overdue for the second customer to show all states.
      let balance = 0
      for (let i = 1; i < readings.length; i++) {
        const prev = readings[i - 1]
        const cur = readings[i]
        const consumption = calculateConsumption(prev.value, cur.value)
        const amount = roundMoney(consumption * SAMPLE_TARIFF)
        const isLatest = i === readings.length - 1
        // The newest invoice is the current bill: due at least 10 days after the script runs,
        // so the demo always has UNPAID invoices to pay, whatever the date.
        const dueDate = new Date(
          isLatest
            ? Math.max(cur.date.getTime() + 20 * day, now.getTime() + 10 * day)
            : cur.date.getTime() + 20 * day,
        )
        const status = isLatest
          ? dueDate < now
            ? 'OVERDUE'
            : 'UNPAID'
          : c.id === 'sample-cust-2' && i === readings.length - 2
            ? 'OVERDUE'
            : 'PAID'
        const invoiceId = `sample-inv-${a.key}-${i}`
        const invoiceNumber = `INV-${billingPeriodOf(cur.date).replace('-', '')}-${a.number.slice(-4)}`
        const paidAt = status === 'PAID' ? new Date(dueDate.getTime() - 5 * day) : null

        put<Invoice>(`invoices/${invoiceId}`, {
          invoiceNumber,
          accountId,
          customerId: c.id,
          billingPeriod: billingPeriodOf(cur.date),
          previousReading: prev.value,
          currentReading: cur.value,
          consumption,
          tariffRate: SAMPLE_TARIFF,
          amount,
          status,
          dueDate,
          paidAt,
          createdAt: cur.date,
        })

        if (status === 'PAID') {
          put<Payment>(`payments/sample-pay-${a.key}-${i}`, {
            invoiceId,
            accountId,
            customerId: c.id,
            amount,
            status: 'SUCCESS',
            paymentMethod: 'CARD',
            reference: `MOCK-${a.number.slice(-3)}${i}X7K`,
            provider: 'MOCK',
            paidAt,
            createdAt: paidAt!,
          })
        } else {
          balance = roundMoney(balance + amount)
        }
        if (isLatest)
          invoicesForNotifications.push({
            id: invoiceId,
            number: invoiceNumber,
            amount,
            customerId: c.id,
          })
      }

      put<Account>(`accounts/${accountId}`, {
        accountNumber: a.number,
        customerId: c.id,
        meterId,
        balance,
        status: 'ACTIVE',
        propertyAddress: a.address,
        area: c.area,
        createdAt: daysAgo(900),
        updatedAt: last.date,
      })
    })
  })

  // -- Assets ----------------------------------------------------------------
  const assets: (Seed<Asset> & { id: string })[] = [
    {
      id: 'sample-asset-res',
      code: 'RES-004',
      name: 'KaNyamazane Hilltop Reservoir',
      type: 'RESERVOIR',
      location: 'Hilltop, KaNyamazane',
      area: 'KaNyamazane',
      status: 'ACTIVE',
      description: '15 ML concrete reservoir supplying KaNyamazane and Tekwane.',
      createdAt: daysAgo(2000),
      updatedAt: daysAgo(60),
    },
    {
      id: 'sample-asset-bh',
      code: 'BH-012',
      name: 'Matsulu Borehole 12',
      type: 'BOREHOLE',
      location: 'Extension 3, Matsulu',
      area: 'Matsulu',
      status: 'MAINTENANCE',
      description: 'Pump replacement scheduled.',
      createdAt: daysAgo(1500),
      updatedAt: daysAgo(3),
    },
    {
      id: 'sample-asset-wtp',
      code: 'WTP-001',
      name: 'Mbombela Water Treatment Works',
      type: 'TREATMENT_PLANT',
      location: 'Riverside, Mbombela',
      area: 'Mbombela CBD',
      status: 'ACTIVE',
      description: 'Main treatment works for the central supply zone.',
      createdAt: daysAgo(4000),
      updatedAt: daysAgo(10),
    },
    {
      id: 'sample-asset-pipe',
      code: 'PIPE-231',
      name: 'Jacaranda Ave 160 mm main',
      type: 'PIPE',
      location: 'Jacaranda Avenue, White River',
      area: 'White River',
      status: 'ACTIVE',
      description: 'uPVC distribution main, installed 2004.',
      createdAt: daysAgo(3000),
      updatedAt: daysAgo(2),
    },
  ]
  assets.forEach(({ id, ...a }) => put<Asset>(`assets/${id}`, a))

  // -- Tickets with history --------------------------------------------------
  const c1 = customers[0]
  const c2 = customers[1]
  const tickets: { id: string; t: Seed<Ticket>; history: Seed<TicketHistoryEntry>[] }[] = [
    {
      id: 'sample-ticket-1',
      t: {
        ticketNumber: 'TKT-SAMPLE-A7K2',
        customerId: c1.id,
        accountId: 'sample-acc-1',
        assetId: null,
        type: 'LEAK',
        description:
          'Water leaking from the pavement outside the gate, getting worse since this morning.',
        priority: 'MEDIUM',
        status: 'OPEN',
        location: c1.accounts[0].address,
        area: c1.area,
        customerName: c1.name,
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        createdBy: c1.id,
        createdAt: daysAgo(0, 8),
        updatedAt: daysAgo(0, 8),
        resolvedAt: null,
      },
      history: [
        {
          fromStatus: null,
          toStatus: 'OPEN',
          note: 'Reported via customer portal.',
          changedBy: c1.id,
          changedByName: c1.name,
          createdAt: daysAgo(0, 8),
        },
      ],
    },
    {
      id: 'sample-ticket-2',
      t: {
        ticketNumber: 'TKT-SAMPLE-M3QP',
        customerId: c2.id,
        accountId: 'sample-acc-3',
        assetId: 'sample-asset-pipe',
        type: 'BURST_PIPE',
        description: 'Burst main flooding the road near the school.',
        priority: 'CRITICAL',
        status: 'IN_PROGRESS',
        location: 'Jacaranda Avenue, White River',
        area: c2.area,
        customerName: c2.name,
        assignedTechnicianId: technicianId,
        assignedTechnicianName: technicianName,
        createdBy: staffId,
        createdAt: daysAgo(1, 14),
        updatedAt: daysAgo(0, 7),
        resolvedAt: null,
      },
      history: [
        {
          fromStatus: null,
          toStatus: 'OPEN',
          note: 'Logged by call centre after customer phoned in.',
          changedBy: staffId,
          changedByName: 'Call centre',
          createdAt: daysAgo(1, 14),
        },
        {
          fromStatus: 'OPEN',
          toStatus: 'OPEN',
          note: `Assigned to ${technicianName}.`,
          changedBy: staffId,
          changedByName: 'Call centre',
          createdAt: daysAgo(1, 15),
        },
        {
          fromStatus: 'OPEN',
          toStatus: 'IN_PROGRESS',
          note: 'On site. Valve closed, excavating.',
          changedBy: technicianId,
          changedByName: technicianName,
          createdAt: daysAgo(0, 7),
        },
      ],
    },
    {
      id: 'sample-ticket-3',
      t: {
        ticketNumber: 'TKT-SAMPLE-R8WD',
        customerId: c1.id,
        accountId: 'sample-acc-2',
        assetId: null,
        type: 'NO_WATER',
        description: 'No water at the Tekwane property since yesterday evening.',
        priority: 'HIGH',
        status: 'RESOLVED',
        location: c1.accounts[1].address,
        area: 'Tekwane',
        customerName: c1.name,
        assignedTechnicianId: technicianId,
        assignedTechnicianName: technicianName,
        createdBy: c1.id,
        createdAt: daysAgo(6, 7),
        updatedAt: daysAgo(5, 16),
        resolvedAt: daysAgo(5, 16),
      },
      history: [
        {
          fromStatus: null,
          toStatus: 'OPEN',
          note: 'Reported via customer portal.',
          changedBy: c1.id,
          changedByName: c1.name,
          createdAt: daysAgo(6, 7),
        },
        {
          fromStatus: 'OPEN',
          toStatus: 'IN_PROGRESS',
          note: 'Airlock found in the supply line.',
          changedBy: technicianId,
          changedByName: technicianName,
          createdAt: daysAgo(5, 11),
        },
        {
          fromStatus: 'IN_PROGRESS',
          toStatus: 'RESOLVED',
          note: 'Line bled and pressure restored. Customer confirmed supply.',
          changedBy: technicianId,
          changedByName: technicianName,
          createdAt: daysAgo(5, 16),
        },
      ],
    },
  ]
  tickets.forEach(({ id, t, history }) => {
    put<Ticket>(`tickets/${id}`, t)
    history.forEach((h, i) => put<TicketHistoryEntry>(`tickets/${id}/ticketHistory/h${i + 1}`, h))
  })

  // -- Water quality: three normal results and one alert ---------------------
  const tests: [string, string, WaterQualityParameter, number, number][] = [
    ['sample-wq-1', 'sample-asset-wtp', 'PH', 7.4, 2],
    ['sample-wq-2', 'sample-asset-wtp', 'FREE_CHLORINE', 0.8, 2],
    ['sample-wq-3', 'sample-asset-res', 'TURBIDITY', 1.8, 1], // above 1 NTU → ALERT
    ['sample-wq-4', 'sample-asset-bh', 'E_COLI', 0, 3],
  ]
  tests.forEach(([id, assetId, parameter, result, ago]) => {
    const p = WATER_QUALITY_PARAMETERS[parameter]
    put<WaterQualityTest>(`waterQualityTests/${id}`, {
      assetId,
      assetName: assets.find((a) => a.id === assetId)!.name,
      sampleDate: daysAgo(ago, 8),
      parameter,
      result,
      unit: p.unit,
      acceptableMin: p.min,
      acceptableMax: p.max,
      status: evaluateWaterQuality(result, p.min, p.max),
      recordedBy: staffId,
      createdAt: daysAgo(ago, 10),
    })
  })

  // -- Outage notices --------------------------------------------------------
  put<OutageNotice>('outageNotices/sample-outage-1', {
    title: 'Low pressure in KaNyamazane and Tekwane',
    description:
      'Reduced pressure while the Hilltop Reservoir is cleaned. Supply may be intermittent on higher ground.',
    affectedAreas: ['KaNyamazane', 'Tekwane'],
    startTime: daysAgo(0, 6),
    expectedResolution: daysAgo(-1, 18),
    severity: 'MEDIUM',
    status: 'ACTIVE',
    createdBy: staffId,
    createdAt: daysAgo(1, 16),
    updatedAt: daysAgo(0, 6),
  })
  put<OutageNotice>('outageNotices/sample-outage-2', {
    title: 'Planned maintenance: Matsulu Borehole 12',
    description: 'Pump replacement. Water will be off in Matsulu Extension 3 during the works.',
    affectedAreas: ['Matsulu'],
    startTime: daysAgo(-3, 8),
    expectedResolution: daysAgo(-3, 14),
    severity: 'HIGH',
    status: 'SCHEDULED',
    createdBy: staffId,
    createdAt: daysAgo(2, 12),
    updatedAt: daysAgo(2, 12),
  })

  // -- Notifications for the demo customer -----------------------------------
  const c1Invoice = invoicesForNotifications.find((i) => i.customerId === c1.id)!
  const notes: [string, Seed<Notification>][] = [
    [
      'sample-note-1',
      {
        userId: c1.id,
        title: 'Ticket resolved',
        message: 'TKT-SAMPLE-R8WD: supply restored at 3 Protea Close, Tekwane.',
        type: 'TICKET',
        relatedId: 'sample-ticket-3',
        link: '/customer/tickets',
        read: true,
        createdAt: daysAgo(5, 16),
      },
    ],
    [
      'sample-note-2',
      {
        userId: c1.id,
        title: 'New invoice',
        message: `${c1Invoice.number} for R ${c1Invoice.amount.toFixed(2)} is ready.`,
        type: 'BILLING',
        relatedId: c1Invoice.id,
        link: '/customer/bills',
        read: false,
        createdAt: monthDay(0) < now ? monthDay(0) : daysAgo(2),
      },
    ],
    [
      'sample-note-3',
      {
        userId: c1.id,
        title: 'Outage in your area',
        message: 'Low pressure in KaNyamazane and Tekwane while the reservoir is cleaned.',
        type: 'OUTAGE',
        relatedId: 'sample-outage-1',
        link: '/customer',
        read: false,
        createdAt: daysAgo(1, 16),
      },
    ],
  ]
  notes.forEach(([id, n]) => put<Notification>(`notifications/${id}`, n))

  // -- Billing settings (the tariff the sample invoices were issued at) ------
  put<BillingSettings>('settings/billing', {
    tariffRate: SAMPLE_TARIFF,
    paymentTermsDays: 21,
    updatedAt: daysAgo(400),
    updatedBy: staffId,
  })

  // -- Audit logs ------------------------------------------------------------
  put<AuditLog>('auditLogs/sample-audit-1', {
    userId: staffId,
    userName: 'Call centre',
    userRole: 'call_centre',
    action: 'TICKET_ASSIGNED',
    entity: 'tickets',
    entityId: 'sample-ticket-2',
    details: `Assigned to ${technicianName}`,
    timestamp: daysAgo(1, 15),
  })
  put<AuditLog>('auditLogs/sample-audit-2', {
    userId: technicianId,
    userName: technicianName,
    userRole: 'technician',
    action: 'TICKET_RESOLVED',
    entity: 'tickets',
    entityId: 'sample-ticket-3',
    details: 'Status IN_PROGRESS → RESOLVED',
    timestamp: daysAgo(5, 16),
  })

  return docs
}
