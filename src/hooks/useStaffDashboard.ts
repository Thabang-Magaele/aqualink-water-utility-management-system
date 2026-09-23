import { useCallback, useEffect, useState } from 'react'
import { metricsFor, type ActivityItem, type MetricId } from '../services/dashboardQueries'
import {
  dashboardErrorMessage,
  loadActivity,
  loadMetric,
  type MetricResult,
} from '../services/dashboardService'
import type { Role } from '../types/user'

export type MetricState =
  | { status: 'loading' }
  | { status: 'ready'; result: MetricResult }
  | { status: 'error'; message: string }

export type ActivityState =
  | { status: 'loading' }
  | { status: 'ready'; items: ActivityItem[] }
  | { status: 'error'; message: string }

/**
 * Loads every dashboard figure for the role in parallel. Each figure settles
 * independently, so one failing query doesn't blank the dashboard.
 * On refresh, existing values stay visible until new ones arrive.
 */
export function useStaffDashboard(role: Role | null, uid: string | undefined) {
  const [metrics, setMetrics] = useState<Partial<Record<MetricId, MetricState>>>({})
  const [activity, setActivity] = useState<ActivityState>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    if (!uid || !role) return
    let cancelled = false
    const ctx = { uid, now: new Date() }
    const defs = metricsFor(role)

    const metricJobs = defs.map((def) =>
      loadMetric(def, ctx).then(
        (result) => {
          if (!cancelled) setMetrics((m) => ({ ...m, [def.id]: { status: 'ready', result } }))
        },
        (error) => {
          if (!cancelled)
            setMetrics((m) => ({
              ...m,
              [def.id]: { status: 'error', message: dashboardErrorMessage(error) },
            }))
        },
      ),
    )
    const activityJob = loadActivity(role, ctx).then(
      (items) => {
        if (!cancelled) setActivity({ status: 'ready', items })
      },
      (error) => {
        if (!cancelled) setActivity({ status: 'error', message: dashboardErrorMessage(error) })
      },
    )

    Promise.allSettled([...metricJobs, activityJob]).then(() => {
      if (!cancelled) {
        setRefreshing(false)
        setUpdatedAt(new Date())
      }
    })
    return () => {
      cancelled = true
    }
  }, [role, uid, runId])

  const refresh = useCallback(() => {
    setRefreshing(true)
    setRunId((n) => n + 1)
  }, [])

  return { metrics, activity, refreshing, updatedAt, refresh }
}
