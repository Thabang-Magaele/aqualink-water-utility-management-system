/**
 * How each dashboard figure is shown. The queries behind them live in
 * src/services/dashboardQueries.ts.
 */
import {
  CalendarClock,
  CircleCheck,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FlaskConical,
  Receipt,
  Ticket,
  TriangleAlert,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { MetricId } from '../../../services/dashboardQueries'
import type { MetricResult } from '../../../services/dashboardService'
import { formatCurrency, formatNumber } from '../../../utils/format'
import type { Tone } from '../../../utils/status'

export interface MetricDisplay {
  label: string
  icon: LucideIcon
  /** Page the card links to (only if the viewer's role can open it). */
  to?: string
  value: (r: MetricResult) => string
  hint?: (r: MetricResult) => string
  tone: (r: MetricResult) => Tone
}

const n = (r: MetricResult) => formatNumber(r.main.count)
const plural = (count: number, one: string, many = `${one}s`) =>
  `${formatNumber(count)} ${count === 1 ? one : many}`

export const METRIC_DISPLAY: Record<MetricId, MetricDisplay> = {
  customers: {
    label: 'Total customers',
    icon: Users,
    to: '/staff/customers',
    value: n,
    tone: () => 'info',
  },
  openTickets: {
    label: 'Open tickets',
    icon: Ticket,
    to: '/staff/tickets',
    value: n,
    hint: (r) =>
      r.secondary?.count ? `${formatNumber(r.secondary.count)} escalated` : 'None escalated',
    tone: (r) => (r.secondary?.count ? 'danger' : 'warning'),
  },
  inProgress: {
    label: 'In-progress jobs',
    icon: Wrench,
    to: '/staff/tickets',
    value: n,
    tone: () => 'info',
  },
  myOpenJobs: {
    label: 'Jobs waiting',
    icon: ClipboardList,
    to: '/staff/field',
    value: n,
    hint: () => 'Assigned to you, not started',
    tone: (r) => (r.main.count ? 'warning' : 'success'),
  },
  myInProgress: {
    label: 'In progress',
    icon: Wrench,
    to: '/staff/field',
    value: n,
    tone: () => 'info',
  },
  myResolved: { label: 'Resolved by you', icon: CircleCheck, value: n, tone: () => 'success' },
  unpaidInvoices: {
    label: 'Unpaid invoices',
    icon: Receipt,
    to: '/staff/billing',
    value: n,
    hint: (r) =>
      `${formatCurrency(r.main.sum ?? 0)} outstanding · ${r.secondary?.count ? `${formatNumber(r.secondary.count)} overdue` : 'none overdue'}`,
    tone: (r) => (r.secondary?.count ? 'danger' : 'warning'),
  },
  invoicedThisMonth: {
    label: 'Invoiced this month',
    icon: CircleDollarSign,
    to: '/staff/billing',
    value: (r) => formatCurrency(r.main.sum ?? 0),
    hint: (r) => plural(r.main.count, 'invoice'),
    tone: () => 'info',
  },
  activeOutages: {
    label: 'Active outages',
    icon: TriangleAlert,
    to: '/staff/communications',
    value: n,
    hint: (r) =>
      r.secondary?.count ? `${formatNumber(r.secondary.count)} scheduled` : 'None scheduled',
    tone: (r) => (r.main.count ? 'danger' : 'success'),
  },
  scheduledOutages: {
    label: 'Scheduled outages',
    icon: CalendarClock,
    to: '/staff/communications',
    value: n,
    tone: () => 'info',
  },
  qualityAlerts: {
    label: 'Water-quality alerts',
    icon: FlaskConical,
    to: '/staff/water-quality',
    value: n,
    hint: () => 'Last 30 days',
    tone: (r) => (r.main.count ? 'danger' : 'success'),
  },
  testsThisMonth: {
    label: 'Tests this month',
    icon: FlaskConical,
    to: '/staff/water-quality',
    value: n,
    tone: () => 'info',
  },
  assetsAttention: {
    label: 'Assets needing attention',
    icon: Factory,
    to: '/staff/assets',
    value: n,
    hint: (r) =>
      r.secondary?.count ? `${formatNumber(r.secondary.count)} offline` : 'None offline',
    tone: (r) => (r.secondary?.count ? 'danger' : r.main.count ? 'warning' : 'success'),
  },
}
