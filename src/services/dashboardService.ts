/**
 * Runs the dashboard definitions in dashboardQueries.ts against the app's Firestore.
 * Counts and sums are calculated by Firestore on the server; no documents are downloaded.
 */
import { count, getAggregateFromServer, sum } from 'firebase/firestore'
import type { Role } from '../types/user'
import {
  activitySourceFor,
  type ActivityItem,
  type AggregateSpec,
  type DashboardContext,
  type MetricDef,
} from './dashboardQueries'
import { db } from './firebase'

export interface Aggregate {
  count: number
  /** Present when the spec asked for a sum. */
  sum?: number
}

export interface MetricResult {
  main: Aggregate
  secondary?: Aggregate
}

async function aggregate(spec: AggregateSpec): Promise<Aggregate> {
  if (spec.sumField) {
    const snap = await getAggregateFromServer(spec.query, {
      count: count(),
      total: sum(spec.sumField),
    })
    return { count: snap.data().count, sum: snap.data().total ?? 0 }
  }
  const snap = await getAggregateFromServer(spec.query, { count: count() })
  return { count: snap.data().count }
}

export async function loadMetric(metric: MetricDef, ctx: DashboardContext): Promise<MetricResult> {
  const { main, secondary } = metric.build(db, ctx)
  const [mainResult, secondaryResult] = await Promise.all([
    aggregate(main),
    secondary ? aggregate(secondary) : undefined,
  ])
  return { main: mainResult, secondary: secondaryResult }
}

export async function loadActivity(
  role: Role | null,
  ctx: DashboardContext,
  max = 8,
): Promise<ActivityItem[]> {
  const source = activitySourceFor(role)
  return source ? source.load(db, ctx, max) : []
}

/** Friendly reason for a failed dashboard query. */
export function dashboardErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code
  if (code === 'failed-precondition') return 'Index still building. Try again in a few minutes.'
  if (code === 'permission-denied') return 'Not available for your role.'
  if (code === 'unavailable') return 'Offline. Check your connection.'
  if (import.meta.env.DEV) console.error(error)
  return "Couldn't load."
}
