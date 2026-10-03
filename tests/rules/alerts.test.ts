/**
 * Outage and water-quality notifications, end to end against the Firestore
 * emulator: the real server code in functions/src/shared/alertStore.ts.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
// The functions' own firebase-admin copy (see functions/src/shared/adminApp.ts)
import {
  getApps,
  getFirestore as adminDb,
  initializeApp,
} from '../../functions/src/shared/adminApp'
import type { OutageSnapshot, WaterTestSnapshot } from '../../functions/src/shared/alerts'
import { notifyOutage, notifyWaterAlert } from '../../functions/src/shared/alertStore'
import { buildSampleData } from '../../scripts/sample-data'

let env: RulesTestEnvironment
const CUSTOMER = 'custA' // Thandi: properties in KaNyamazane (acc-1) and Tekwane (acc-2)
const sample = buildSampleData({
  customerUid: CUSTOMER,
  technicianUid: 'tech1',
  staffUid: 'admin1',
})
const docData = (path: string) => sample.find((d) => d.path === path)!.data
const outage1 = docData('outageNotices/sample-outage-1') as unknown as OutageSnapshot // KaNyamazane + Tekwane
const outage2 = docData('outageNotices/sample-outage-2') as unknown as OutageSnapshot // Matsulu
const wqAlert = docData('waterQualityTests/sample-wq-3') as unknown as WaterTestSnapshot // turbidity 1.8 NTU

const notificationsFor = async (userId: string) =>
  (await adminDb().collection('notifications').where('userId', '==', userId).get()).docs
const profile = (role: string) => ({
  uid: 'x',
  displayName: role,
  email: `${role}@aqualink.demo`,
  phone: '',
  role,
  createdAt: new Date(),
  updatedAt: new Date(),
})

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aqualink',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  if (!getApps().length) initializeApp({ projectId: 'demo-aqualink' })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const batch = db.batch()
    for (const d of sample)
      if (!d.path.startsWith('notifications/')) batch.set(db.doc(d.path), d.data)
    // Logins: Thandi (customer) and one of each staff role. Sipho and Anele have no login.
    batch.set(db.doc(`users/${CUSTOMER}`), profile('customer'))
    for (const [uid, role] of [
      ['admin1', 'admin'],
      ['wq1', 'water_quality'],
      ['am1', 'asset_manager'],
      ['tech1', 'technician'],
      ['cc1', 'call_centre'],
    ])
      batch.set(db.doc(`users/${uid}`), profile(role))
    await batch.commit()
  })
})

after(async () => {
  await env?.cleanup()
})

describe('Outage notices', () => {
  test('customers with a property in an affected area are told, once each', async () => {
    const sent = await notifyOutage('sample-outage-1', 'active', outage1)
    assert.equal(sent, 1, 'Thandi has two affected properties but gets one message')
    const [n] = await notificationsFor(CUSTOMER)
    assert.equal(n.id, `outage-sample-outage-1-active-${CUSTOMER}`)
    assert.equal(n.get('type'), 'OUTAGE')
    assert.equal(n.get('read'), false)
    assert.match(n.get('title'), /^Water outage: /)
    assert.equal((await notificationsFor('sample-cust-2')).length, 0, 'White River is not affected')
  })
  test("it's the property's area that counts: a Tekwane-only outage reaches Thandi through her Tekwane property", async () => {
    assert.equal(
      await notifyOutage('tekwane-only', 'active', { ...outage1, affectedAreas: ['Tekwane'] }),
      1,
    )
    assert.equal((await notificationsFor(CUSTOMER)).length, 1)
  })
  test('a retried trigger does not send the same message twice', async () => {
    await notifyOutage('sample-outage-1', 'active', outage1)
    assert.equal(await notifyOutage('sample-outage-1', 'active', outage1), 0)
    assert.equal((await notificationsFor(CUSTOMER)).length, 1)
  })
  test('"supply restored" is a separate message', async () => {
    await notifyOutage('sample-outage-1', 'active', outage1)
    await notifyOutage('sample-outage-1', 'restored', { ...outage1, status: 'RESOLVED' })
    const titles = (await notificationsFor(CUSTOMER)).map((n) => n.get('title')).sort()
    assert.deepEqual(
      titles.map((t) => t.split(':')[0]),
      ['Supply restored', 'Water outage'],
    )
  })
  test('customers without a login are skipped; once they register, they are told', async () => {
    assert.equal(
      await notifyOutage('sample-outage-2', 'scheduled', outage2),
      0,
      'Anele (Matsulu) has no login',
    )
    await adminDb().doc('users/sample-cust-3').set(profile('customer'))
    assert.equal(await notifyOutage('sample-outage-2', 'scheduled', outage2), 1)
  })
  test('closed accounts do not count', async () => {
    await adminDb().doc('accounts/sample-acc-1').update({ status: 'CLOSED' })
    await adminDb().doc('accounts/sample-acc-2').update({ status: 'CLOSED' })
    assert.equal(await notifyOutage('sample-outage-1', 'active', outage1), 0)
  })
})

describe('Water-quality alerts', () => {
  test('admins, water-quality staff and asset managers are told; other staff are not', async () => {
    assert.equal(await notifyWaterAlert('sample-wq-3', wqAlert), 3)
    for (const uid of ['admin1', 'wq1', 'am1']) {
      const [n] = await notificationsFor(uid)
      assert.equal(n.get('type'), 'WATER_QUALITY')
      assert.match(n.get('message'), /Turbidity measured 1\.8 NTU/)
    }
    for (const uid of ['tech1', 'cc1', CUSTOMER])
      assert.equal((await notificationsFor(uid)).length, 0)
  })
  test('a retried trigger does not repeat the alert', async () => {
    await notifyWaterAlert('sample-wq-3', wqAlert)
    assert.equal(await notifyWaterAlert('sample-wq-3', wqAlert), 0)
  })
})
