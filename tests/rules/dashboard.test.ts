/**
 * Proves every staff role's dashboard queries are allowed by the security rules,
 * and return the right numbers for the sample dataset. Runs the SAME query
 * definitions the app uses (src/services/dashboardQueries.ts).
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { count, getAggregateFromServer, sum, type Firestore } from 'firebase/firestore'
import { buildSampleData } from '../../scripts/sample-data'
import {
  ACTIVITY_SOURCES,
  METRICS,
  metricsFor,
  type AggregateSpec,
  type DashboardContext,
} from '../../src/services/dashboardQueries'
import { STAFF_ROLES, type Role } from '../../src/types/user'

let env: RulesTestEnvironment

/** uid per role. tech1 is the technician assigned to sample tickets 2 and 3. */
const UIDS: Record<Role, string> = {
  admin: 'admin1',
  call_centre: 'cc1',
  technician: 'tech1',
  billing: 'bill1',
  asset_manager: 'am1',
  water_quality: 'wq1',
  communications: 'comms1',
  customer: 'custA',
}

function dbFor(role: Role): Firestore {
  const uid = UIDS[role]
  return env
    .authenticatedContext(uid, { role, email: `${uid}@aqualink.demo` })
    .firestore() as unknown as Firestore
}
const ctxFor = (role: Role): DashboardContext => ({ uid: UIDS[role], now: new Date() })

async function aggregate(spec: AggregateSpec) {
  const snap = spec.sumField
    ? await getAggregateFromServer(spec.query, { count: count(), total: sum(spec.sumField) })
    : await getAggregateFromServer(spec.query, { count: count() })
  return snap.data() as { count: number; total?: number }
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aqualink', // must match the emulator's single project (firebase.json)
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  // Other test files share this emulator, so start clean. Read-only tests, so seed once.
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const batch = db.batch()
    for (const d of buildSampleData({
      customerUid: 'custA',
      technicianUid: 'tech1',
      staffUid: 'admin1',
    })) {
      batch.set(db.doc(d.path), d.data)
    }
    await batch.commit()
  })
})

after(async () => {
  await env?.cleanup()
})

describe('Every role’s dashboard figures are allowed by the rules', () => {
  for (const role of STAFF_ROLES) {
    test(`${role}: ${metricsFor(role)
      .map((m) => m.id)
      .join(', ')}`, async () => {
      for (const metric of metricsFor(role)) {
        const { main, secondary } = metric.build(dbFor(role), ctxFor(role))
        await assertSucceeds(aggregate(main))
        if (secondary) await assertSucceeds(aggregate(secondary))
      }
    })
  }
})

describe('Every role’s recent-activity feed is allowed by the rules', () => {
  for (const source of ACTIVITY_SOURCES) {
    for (const role of source.roles) {
      test(`${role} reads ${source.collections.join(' + ')}`, async () => {
        const items = await assertSucceeds(source.load(dbFor(role), ctxFor(role), 8))
        assert.ok(items.length > 0, 'sample data should give every feed at least one item')
      })
    }
  }
})

describe('Figures are correct for the sample data', () => {
  const value = async (role: Role, id: string) => {
    const metric = METRICS.find((m) => m.id === id)!
    const { main, secondary } = metric.build(dbFor(role), ctxFor(role))
    return {
      main: await aggregate(main),
      secondary: secondary ? await aggregate(secondary) : undefined,
    }
  }
  test('admin: 3 customers, 1 open ticket, 1 in progress', async () => {
    assert.equal((await value('admin', 'customers')).main.count, 3)
    assert.equal((await value('admin', 'openTickets')).main.count, 1)
    assert.equal((await value('admin', 'inProgress')).main.count, 1)
  })
  test('unpaid invoices: 5 (4 current + 1 overdue), with the overdue one counted separately', async () => {
    const r = await value('billing', 'unpaidInvoices')
    assert.equal(r.main.count, 5)
    assert.equal(r.secondary?.count, 1)
    assert.ok((r.main.total ?? 0) > 0, 'outstanding amount should be summed')
  })
  test('technician tech1: 0 waiting, 1 in progress, 1 resolved (only their jobs)', async () => {
    assert.equal((await value('technician', 'myOpenJobs')).main.count, 0)
    assert.equal((await value('technician', 'myInProgress')).main.count, 1)
    assert.equal((await value('technician', 'myResolved')).main.count, 1)
  })
  test('outages: 1 active, 1 scheduled; water quality: 1 alert; assets: 1 needing attention', async () => {
    const outages = await value('communications', 'activeOutages')
    assert.equal(outages.main.count, 1)
    assert.equal(outages.secondary?.count, 1)
    assert.equal((await value('water_quality', 'qualityAlerts')).main.count, 1)
    assert.equal((await value('asset_manager', 'assetsAttention')).main.count, 1)
  })
})

describe('Why technicians need their own figures', () => {
  test('a technician running the call-centre "open tickets" query is rejected', async () => {
    const callCentreMetric = METRICS.find((m) => m.id === 'openTickets')!
    const { main } = callCentreMetric.build(dbFor('technician'), ctxFor('technician'))
    await assertFails(aggregate(main))
  })
})
