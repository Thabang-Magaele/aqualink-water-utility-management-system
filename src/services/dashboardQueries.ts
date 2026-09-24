/**
 * What the staff dashboard shows, and exactly which Firestore queries produce it.
 *
 * Kept free of React and of the app's Firebase instance (queries receive `db`),
 * so the security-rules tests can run these same queries for every role and prove
 * the rules allow them. Each definition declares the collection it reads, so a
 * unit test can also check it against the access table in docs/security.md.
 */
import {
  collection,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  where,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import {
  TICKET_TYPE_LABELS,
  WATER_QUALITY_PARAMETERS,
  type AuditLog,
  type Invoice,
  type OutageNotice,
  type Payment,
  type Ticket,
  type WaterQualityTest,
} from '../types/models'
import { STAFF_ROLES, type Role } from '../types/user'
import { formatCurrency } from '../utils/format'

export interface DashboardContext {
  uid: string
  now: Date
}

/** A count (and optionally a sum of one numeric field) over a query. */
export interface AggregateSpec {
  query: Query
  sumField?: string
}

export type MetricId =
  | 'customers'
  | 'openTickets'
  | 'inProgress'
  | 'myOpenJobs'
  | 'myInProgress'
  | 'myResolved'
  | 'unpaidInvoices'
  | 'invoicedThisMonth'
  | 'activeOutages'
  | 'scheduledOutages'
  | 'qualityAlerts'
  | 'testsThisMonth'
  | 'assetsAttention'

export interface MetricDef {
  id: MetricId
  /** Roles that see this card. Must be allowed to read `collection` (see docs/security.md). */
  roles: readonly Role[]
  collection: string
  /** `main` is the headline number; `secondary` feeds the hint line (e.g. "3 escalated"). */
  build: (
    db: Firestore,
    ctx: DashboardContext,
  ) => { main: AggregateSpec; secondary?: AggregateSpec }
}

const startOfMonth = (now: Date) => new Date(now.getFullYear(), now.getMonth(), 1)
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000)

/** Order here is the order cards appear in. */
export const METRICS: MetricDef[] = [
  {
    id: 'customers',
    roles: ['admin', 'call_centre', 'billing'],
    collection: 'customers',
    build: (db) => ({ main: { query: collection(db, 'customers') } }),
  },
  {
    id: 'openTickets',
    roles: ['admin', 'call_centre', 'asset_manager'],
    collection: 'tickets',
    build: (db) => ({
      main: {
        query: query(collection(db, 'tickets'), where('status', 'in', ['OPEN', 'ESCALATED'])),
      },
      secondary: { query: query(collection(db, 'tickets'), where('status', '==', 'ESCALATED')) },
    }),
  },
  {
    id: 'inProgress',
    roles: ['admin', 'call_centre', 'asset_manager'],
    collection: 'tickets',
    build: (db) => ({
      main: { query: query(collection(db, 'tickets'), where('status', '==', 'IN_PROGRESS')) },
    }),
  },
  // Technicians may only query tickets assigned to them, so their cards filter by uid.
  {
    id: 'myOpenJobs',
    roles: ['technician'],
    collection: 'tickets',
    build: (db, { uid }) => ({
      main: {
        query: query(
          collection(db, 'tickets'),
          where('assignedTechnicianId', '==', uid),
          where('status', 'in', ['OPEN', 'ESCALATED']),
        ),
      },
    }),
  },
  {
    id: 'myInProgress',
    roles: ['technician'],
    collection: 'tickets',
    build: (db, { uid }) => ({
      main: {
        query: query(
          collection(db, 'tickets'),
          where('assignedTechnicianId', '==', uid),
          where('status', '==', 'IN_PROGRESS'),
        ),
      },
    }),
  },
  {
    id: 'myResolved',
    roles: ['technician'],
    collection: 'tickets',
    build: (db, { uid }) => ({
      main: {
        query: query(
          collection(db, 'tickets'),
          where('assignedTechnicianId', '==', uid),
          where('status', '==', 'RESOLVED'),
        ),
      },
    }),
  },
  {
    id: 'unpaidInvoices',
    roles: ['admin', 'billing', 'call_centre'],
    collection: 'invoices',
    build: (db) => ({
      main: {
        query: query(collection(db, 'invoices'), where('status', 'in', ['UNPAID', 'OVERDUE'])),
        sumField: 'amount',
      },
      secondary: {
        query: query(collection(db, 'invoices'), where('status', '==', 'OVERDUE')),
        sumField: 'amount',
      },
    }),
  },
  {
    id: 'invoicedThisMonth',
    roles: ['admin', 'billing'],
    collection: 'invoices',
    build: (db, { now }) => ({
      main: {
        query: query(collection(db, 'invoices'), where('createdAt', '>=', startOfMonth(now))),
        sumField: 'amount',
      },
    }),
  },
  {
    id: 'activeOutages',
    roles: STAFF_ROLES,
    collection: 'outageNotices',
    build: (db) => ({
      main: { query: query(collection(db, 'outageNotices'), where('status', '==', 'ACTIVE')) },
      secondary: {
        query: query(collection(db, 'outageNotices'), where('status', '==', 'SCHEDULED')),
      },
    }),
  },
  {
    id: 'scheduledOutages',
    roles: ['communications'],
    collection: 'outageNotices',
    build: (db) => ({
      main: { query: query(collection(db, 'outageNotices'), where('status', '==', 'SCHEDULED')) },
    }),
  },
  {
    id: 'qualityAlerts',
    roles: ['admin', 'water_quality', 'asset_manager'],
    collection: 'waterQualityTests',
    build: (db, { now }) => ({
      main: {
        query: query(
          collection(db, 'waterQualityTests'),
          where('status', '==', 'ALERT'),
          where('sampleDate', '>=', daysBefore(now, 30)),
        ),
      },
    }),
  },
  {
    id: 'testsThisMonth',
    roles: ['water_quality'],
    collection: 'waterQualityTests',
    build: (db, { now }) => ({
      main: {
        query: query(
          collection(db, 'waterQualityTests'),
          where('sampleDate', '>=', startOfMonth(now)),
        ),
      },
    }),
  },
  {
    id: 'assetsAttention',
    roles: ['admin', 'asset_manager'],
    collection: 'assets',
    build: (db) => ({
      main: {
        query: query(collection(db, 'assets'), where('status', 'in', ['MAINTENANCE', 'OFFLINE'])),
      },
      secondary: { query: query(collection(db, 'assets'), where('status', '==', 'OFFLINE')) },
    }),
  },
]

export function metricsFor(role: Role | null): MetricDef[] {
  return role ? METRICS.filter((m) => m.roles.includes(role)) : []
}

// ---------------------------------------------------------------------------
// Recent activity: one feed per role, from data that role is allowed to read.
// ---------------------------------------------------------------------------

export type ActivityKind = 'ticket' | 'invoice' | 'payment' | 'waterTest' | 'outage' | 'audit'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  title: string
  detail: string
  at: Date
  status?: string
  /** In-app link, if the viewer can open it. */
  to?: string
}

export interface ActivitySource {
  roles: readonly Role[]
  /** Collections read, for the access-table check. */
  collections: string[]
  load: (db: Firestore, ctx: DashboardContext, max: number) => Promise<ActivityItem[]>
}

const toDate = (value: unknown): Date =>
  value && typeof (value as { toDate?: unknown }).toDate === 'function'
    ? (value as { toDate: () => Date }).toDate()
    : new Date(0)

async function rows<T>(q: Query): Promise<(T & { id: string })[]> {
  // From the server, never the offline cache: an unreachable server must show an
  // error, not an empty "no recent activity" list.
  const snap = await getDocsFromServer(q)
  return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))
}

const ticketItem = (t: Ticket, to: string): ActivityItem => ({
  id: `ticket-${t.id}`,
  kind: 'ticket',
  title: `${t.ticketNumber} · ${TICKET_TYPE_LABELS[t.type] ?? t.type}`,
  detail: [
    t.customerName,
    t.area,
    t.assignedTechnicianName ? `→ ${t.assignedTechnicianName}` : 'Unassigned',
  ]
    .filter(Boolean)
    .join(' · '),
  at: toDate(t.updatedAt),
  status: t.status,
  to,
})

const humanise = (action: string) =>
  action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())

export const ACTIVITY_SOURCES: ActivitySource[] = [
  {
    roles: ['admin'],
    collections: ['auditLogs'],
    load: async (db, _ctx, max) =>
      (
        await rows<AuditLog>(
          query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(max)),
        )
      ).map((a) => ({
        id: `audit-${a.id}`,
        kind: 'audit',
        title: humanise(a.action),
        detail: [a.userName, a.details].filter(Boolean).join(' · '),
        at: toDate(a.timestamp),
        to: '/staff/audit-logs',
      })),
  },
  {
    roles: ['call_centre', 'asset_manager'],
    collections: ['tickets'],
    load: async (db, _ctx, max) =>
      (
        await rows<Ticket>(
          query(collection(db, 'tickets'), orderBy('updatedAt', 'desc'), limit(max)),
        )
      ).map((t) => ticketItem(t, '/staff/tickets')),
  },
  {
    roles: ['technician'],
    collections: ['tickets'],
    load: async (db, { uid }, max) =>
      (
        await rows<Ticket>(
          query(
            collection(db, 'tickets'),
            where('assignedTechnicianId', '==', uid),
            orderBy('updatedAt', 'desc'),
            limit(max),
          ),
        )
      ).map((t) => ticketItem(t, '/staff/field')),
  },
  {
    roles: ['billing'],
    collections: ['payments', 'invoices'],
    load: async (db, _ctx, max) => {
      const [payments, invoices] = await Promise.all([
        rows<Payment>(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(max))),
        rows<Invoice>(query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(max))),
      ])
      const items: ActivityItem[] = [
        ...payments.map((p) => ({
          id: `payment-${p.id}`,
          kind: 'payment' as const,
          title: `Payment received · ${formatCurrency(p.amount)}`,
          detail: `${p.reference} · ${p.paymentMethod}`,
          at: toDate(p.createdAt),
          status: p.status,
          to: '/staff/billing',
        })),
        ...invoices.map((i) => ({
          id: `invoice-${i.id}`,
          kind: 'invoice' as const,
          title: `${i.invoiceNumber} issued · ${formatCurrency(i.amount)}`,
          detail: `Period ${i.billingPeriod} · ${i.consumption} kL`,
          at: toDate(i.createdAt),
          status: i.status,
          to: '/staff/billing',
        })),
      ]
      return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, max)
    },
  },
  {
    roles: ['water_quality'],
    collections: ['waterQualityTests'],
    load: async (db, _ctx, max) =>
      (
        await rows<WaterQualityTest>(
          query(collection(db, 'waterQualityTests'), orderBy('createdAt', 'desc'), limit(max)),
        )
      ).map((w) => ({
        id: `wq-${w.id}`,
        kind: 'waterTest',
        title: `${WATER_QUALITY_PARAMETERS[w.parameter]?.label ?? w.parameter} at ${w.assetName}`,
        detail: `${w.result} ${w.unit}`,
        at: toDate(w.sampleDate),
        status: w.status,
        to: '/staff/water-quality',
      })),
  },
  {
    roles: ['communications'],
    collections: ['outageNotices'],
    load: async (db, _ctx, max) =>
      (
        await rows<OutageNotice>(
          query(collection(db, 'outageNotices'), orderBy('updatedAt', 'desc'), limit(max)),
        )
      ).map((o) => ({
        id: `outage-${o.id}`,
        kind: 'outage',
        title: o.title,
        detail: o.affectedAreas.join(', '),
        at: toDate(o.updatedAt),
        status: o.status,
        to: '/staff/communications',
      })),
  },
]

export function activitySourceFor(role: Role | null): ActivitySource | undefined {
  return role ? ACTIVITY_SOURCES.find((s) => s.roles.includes(role)) : undefined
}
