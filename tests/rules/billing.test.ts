/**
 * Billing (Phase 10): tariff settings and the invoice screens' queries, checked
 * against the security rules as each role. Invoice creation itself is server-only
 * (see access.test.ts and tests/functions/billing.test.ts).
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { getDoc, getDocs, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { buildSampleData } from '../../scripts/sample-data'
import { billingQueries, settingsPayload } from '../../src/services/billingQueries'
import type { Role } from '../../src/types/user'

let env: RulesTestEnvironment
const CUSTOMER = 'custA'

function dbAs(uid: string, role?: Role): Firestore {
  const claims: Record<string, string> = { email: `${uid}@aqualink.demo` }
  if (role) claims.role = role
  return env.authenticatedContext(uid, claims).firestore() as unknown as Firestore
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aqualink',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const batch = db.batch()
    for (const d of buildSampleData({
      customerUid: CUSTOMER,
      technicianUid: 'tech1',
      staffUid: 'admin1',
    }))
      batch.set(db.doc(d.path), d.data)
    batch.set(db.doc('settings/billing'), {
      tariffRate: 28.5,
      paymentTermsDays: 21,
      updatedAt: new Date(),
      updatedBy: 'admin1',
    })
    await batch.commit()
  })
})

after(async () => {
  await env?.cleanup()
})

describe('Tariff settings', () => {
  for (const role of ['admin', 'billing', 'call_centre'] as Role[]) {
    test(`${role} can read the tariff`, async () => {
      const snap = await assertSucceeds(getDoc(billingQueries.settings(dbAs(`${role}1`, role))))
      assert.equal(snap.data()?.tariffRate, 28.5)
    })
  }
  test('technicians and customers cannot read the settings document', async () => {
    await assertFails(getDoc(billingQueries.settings(dbAs('tech1', 'technician'))))
    await assertFails(getDoc(billingQueries.settings(dbAs(CUSTOMER))))
  })
  test('an admin can change the tariff (the exact payload the app writes)', async () => {
    await assertSucceeds(
      setDoc(
        billingQueries.settings(dbAs('admin1', 'admin')),
        settingsPayload({ tariffRate: 31.75, paymentTermsDays: 30 }, 'admin1', serverTimestamp()),
      ),
    )
  })
  test('billing cannot change the tariff', async () => {
    await assertFails(
      setDoc(
        billingQueries.settings(dbAs('bill1', 'billing')),
        settingsPayload({ tariffRate: 1, paymentTermsDays: 30 }, 'bill1', serverTimestamp()),
      ),
    )
  })
  test('nonsense values are refused even for an admin', async () => {
    const db = dbAs('admin1', 'admin')
    await assertFails(
      setDoc(
        billingQueries.settings(db),
        settingsPayload({ tariffRate: 0, paymentTermsDays: 21 }, 'admin1', serverTimestamp()),
      ),
    )
    await assertFails(
      setDoc(
        billingQueries.settings(db),
        settingsPayload({ tariffRate: 28.5, paymentTermsDays: 365 }, 'admin1', serverTimestamp()),
      ),
    )
    await assertFails(
      setDoc(
        billingQueries.settings(db),
        settingsPayload(
          { tariffRate: 28.5, paymentTermsDays: 21 },
          'someone-else',
          serverTimestamp(),
        ),
      ),
    )
  })
})

describe('Invoice screens', () => {
  for (const role of ['admin', 'billing'] as Role[]) {
    test(`${role}: the Billing page's invoice list and an invoice`, async () => {
      const db = dbAs(`${role}1`, role)
      const list = await assertSucceeds(getDocs(billingQueries.allInvoices(db)))
      assert.equal(list.size, 16)
      await assertSucceeds(getDoc(billingQueries.invoice(db, 'sample-inv-acc-3-1')))
    })
  }
  test('technician: refused invoices', async () => {
    await assertFails(getDocs(billingQueries.allInvoices(dbAs('tech1', 'technician'))))
  })
  test('customer: their own bills list and one of their invoices', async () => {
    const db = dbAs(CUSTOMER)
    const mine = await assertSucceeds(getDocs(billingQueries.customerInvoices(db, CUSTOMER)))
    assert.equal(mine.size, 8)
    await assertSucceeds(getDoc(billingQueries.invoice(db, 'sample-inv-acc-1-4')))
  })
  test("customer: refused another customer's invoice and the staff list", async () => {
    const db = dbAs(CUSTOMER)
    await assertFails(getDoc(billingQueries.invoice(db, 'sample-inv-acc-3-1')))
    await assertFails(getDocs(billingQueries.allInvoices(db)))
  })
})
