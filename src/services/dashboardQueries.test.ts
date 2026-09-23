import { describe, expect, it } from 'vitest'
import { STAFF_ROLES, type Role } from '../types/user'
import { ACTIVITY_SOURCES, METRICS, metricsFor } from './dashboardQueries'

/**
 * Which staff roles may READ each collection. Mirrors firestore.rules / docs/security.md.
 * If you change the rules, change this too. The emulator test (tests/rules/dashboard.test.ts)
 * then proves the real rules agree.
 */
const READ_ACCESS: Record<string, readonly Role[]> = {
  customers: ['admin', 'call_centre', 'billing'],
  tickets: ['admin', 'call_centre', 'asset_manager', 'technician'], // technician: assigned only
  invoices: ['admin', 'call_centre', 'billing'],
  payments: ['admin', 'billing'],
  assets: STAFF_ROLES,
  waterQualityTests: ['admin', 'water_quality', 'asset_manager'],
  outageNotices: STAFF_ROLES,
  auditLogs: ['admin'],
}

describe('dashboard figures', () => {
  it('have unique ids', () => {
    const ids = METRICS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(METRICS.map((m) => [m.id, m] as const))(
    '%s is only shown to roles that may read its collection',
    (_id, metric) => {
      const allowed = READ_ACCESS[metric.collection]
      expect(allowed, `no access entry for ${metric.collection}`).toBeDefined()
      for (const role of metric.roles) expect(allowed).toContain(role)
    },
  )

  it.each(STAFF_ROLES.map((r) => [r]))('%s sees at least two figures', (role) => {
    expect(metricsFor(role).length).toBeGreaterThanOrEqual(2)
  })

  it('customers see no staff figures', () => {
    expect(metricsFor('customer')).toEqual([])
  })

  it('technicians only get figures filtered to their own jobs', () => {
    const tech = metricsFor('technician').filter((m) => m.collection === 'tickets')
    expect(tech.map((m) => m.id).sort()).toEqual(['myInProgress', 'myOpenJobs', 'myResolved'])
  })

  it('admin sees the headline figures from the spec', () => {
    const ids = metricsFor('admin').map((m) => m.id)
    for (const id of [
      'customers',
      'openTickets',
      'inProgress',
      'unpaidInvoices',
      'activeOutages',
    ] as const) {
      expect(ids).toContain(id)
    }
  })
})

describe('recent activity sources', () => {
  it('every staff role has exactly one feed', () => {
    for (const role of STAFF_ROLES) {
      expect(
        ACTIVITY_SOURCES.filter((s) => s.roles.includes(role)),
        role,
      ).toHaveLength(1)
    }
  })
  it.each(ACTIVITY_SOURCES.map((s) => [s.roles.join(', '), s] as const))(
    'feed for %s only reads permitted collections',
    (_r, source) => {
      for (const collection of source.collections) {
        for (const role of source.roles) expect(READ_ACCESS[collection]).toContain(role)
      }
    },
  )
})
