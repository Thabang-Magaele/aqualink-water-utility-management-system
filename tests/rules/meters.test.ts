/**
 * Meters and readings: the Phase 9 screens' exact queries and writes, checked
 * against the security rules as each role (src/services/meterQueries.ts).
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
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { buildSampleData } from '../../scripts/sample-data'
import {
  linkMeterUpdate,
  meterAfterReading,
  meterQueries,
  meterStatusUpdate,
  newMeterPayload,
  readingPayload,
} from '../../src/services/meterQueries'
import type { Role } from '../../src/types/user'

let env: RulesTestEnvironment
const CUSTOMER = 'custA'
const METER = { id: 'sample-meter-1', accountId: 'sample-acc-1', customerId: CUSTOMER }

function dbAs(uid: string, role?: Role): Firestore {
  const claims: Record<string, string> = { email: `${uid}@aqualink.demo` }
  if (role) claims.role = role
  return env.authenticatedContext(uid, claims).firestore() as unknown as Firestore
}

async function seededMeter(): Promise<{ lastReading: number; lastReadingDate: Date }> {
  let out = { lastReading: 0, lastReadingDate: new Date(0) }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = (await ctx.firestore().doc(`meters/${METER.id}`).get()).data()!
    out = { lastReading: d.lastReading, lastReadingDate: d.lastReadingDate.toDate() }
  })
  return out
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
    })) {
      batch.set(db.doc(d.path), d.data)
    }
    // An account with no meter yet, for the "add meter" tests
    batch.set(db.doc('accounts/acc-new'), {
      accountNumber: '4100999002',
      customerId: CUSTOMER,
      meterId: null,
      balance: 0,
      status: 'ACTIVE',
      propertyAddress: '8 Kiaat Street, KaNyamazane',
      area: 'KaNyamazane',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await batch.commit()
  })
})

after(async () => {
  await env?.cleanup()
})

describe('Reading meter data', () => {
  for (const role of ['admin', 'billing'] as Role[]) {
    test(`${role}: meter list, a meter and its readings`, async () => {
      const db = dbAs(`${role}1`, role)
      const meters = await assertSucceeds(getDocs(meterQueries.allMeters(db)))
      assert.equal(meters.size, 4)
      await assertSucceeds(getDoc(meterQueries.meter(db, METER.id)))
      const readings = await assertSucceeds(getDocs(meterQueries.meterReadings(db, METER.id)))
      assert.equal(readings.size, 5)
    })
  }
  test('technician: refused meters and readings', async () => {
    const db = dbAs('tech1', 'technician')
    await assertFails(getDocs(meterQueries.allMeters(db)))
    await assertFails(getDocs(meterQueries.meterReadings(db, METER.id)))
  })
  test('customer: their own meters, accounts and readings (the Usage page queries)', async () => {
    const db = dbAs(CUSTOMER)
    const meters = await assertSucceeds(getDocs(meterQueries.customerMeters(db, CUSTOMER)))
    assert.equal(meters.size, 2)
    await assertSucceeds(getDocs(meterQueries.customerAccounts(db, CUSTOMER)))
    const readings = await assertSucceeds(getDocs(meterQueries.customerReadings(db, CUSTOMER)))
    assert.equal(readings.size, 10)
  })
  test("customer: refused another customer's usage, and the staff meter query", async () => {
    const db = dbAs(CUSTOMER)
    await assertFails(getDocs(meterQueries.customerReadings(db, 'sample-cust-2')))
    // The staff query doesn't filter by customer, so the rules can't prove ownership:
    // this is why the Usage page queries by customerId.
    await assertFails(getDocs(meterQueries.meterReadings(db, METER.id)))
  })
})

describe('Recording readings (reading + meter update in one batch)', () => {
  async function record(db: Firestore, value: number, date: Date, recordedBy: string) {
    const batch = writeBatch(db)
    batch.set(
      doc(collection(db, 'readings')),
      readingPayload(METER, value, date, recordedBy, serverTimestamp()),
    )
    batch.update(
      meterQueries.meter(db, METER.id),
      meterAfterReading(value, date, serverTimestamp()),
    )
    return batch.commit()
  }

  test('billing: a valid reading is saved', async () => {
    const m = await seededMeter()
    await assertSucceeds(
      record(
        dbAs('bill1', 'billing'),
        m.lastReading + 15.2,
        new Date(Date.now() - 60_000),
        'bill1',
      ),
    )
  })
  test('rejected: dated before the meter’s last reading, even if the value is higher', async () => {
    const m = await seededMeter()
    const before = new Date(m.lastReadingDate.getTime() - 86_400_000)
    await assertFails(record(dbAs('bill1', 'billing'), m.lastReading + 15.2, before, 'bill1'))
  })
  test('rejected: lower than the last reading', async () => {
    const m = await seededMeter()
    await assertFails(
      record(dbAs('bill1', 'billing'), m.lastReading - 0.1, new Date(Date.now() - 60_000), 'bill1'),
    )
  })
  test('rejected: moving the meter’s last-reading date backwards', async () => {
    const m = await seededMeter()
    await assertFails(
      updateDoc(
        meterQueries.meter(dbAs('bill1', 'billing'), METER.id),
        meterAfterReading(
          m.lastReading,
          new Date(m.lastReadingDate.getTime() - 86_400_000),
          serverTimestamp(),
        ),
      ),
    )
  })
  test('rejected: customers and technicians recording readings', async () => {
    const m = await seededMeter()
    await assertFails(
      record(dbAs(CUSTOMER), m.lastReading + 1, new Date(Date.now() - 60_000), CUSTOMER),
    )
    await assertFails(
      record(
        dbAs('tech1', 'technician'),
        m.lastReading + 1,
        new Date(Date.now() - 60_000),
        'tech1',
      ),
    )
  })
})

describe('Adding a meter to an account', () => {
  const installed = () => new Date(Date.now() - 60_000)
  async function addMeter(db: Firestore, uid: string) {
    const input = {
      meterNumber: 'mtr-999002',
      accountId: 'acc-new',
      customerId: CUSTOMER,
      installationDate: installed(),
      initialReading: 0,
    }
    const meterRef = doc(collection(db, 'meters'))
    const batch = writeBatch(db)
    batch.set(meterRef, newMeterPayload(input, serverTimestamp()))
    batch.update(
      meterQueries.account(db, 'acc-new'),
      linkMeterUpdate(meterRef.id, serverTimestamp()),
    )
    await batch.commit()
    // Then the baseline reading, exactly as meterService.addMeter does
    const meter = { id: meterRef.id, accountId: 'acc-new', customerId: CUSTOMER }
    await writeBatch(db)
      .set(
        doc(collection(db, 'readings')),
        readingPayload(meter, 0, input.installationDate, uid, serverTimestamp()),
      )
      .commit()
    return meterRef.id
  }

  test('billing: meter + account link, then the baseline reading', async () => {
    const id = await assertSucceeds(addMeter(dbAs('bill1', 'billing'), 'bill1'))
    await env.withSecurityRulesDisabled(async (ctx) => {
      const account = (await ctx.firestore().doc('accounts/acc-new').get()).data()!
      assert.equal(account.meterId, id)
      const meter = (await ctx.firestore().doc(`meters/${id}`).get()).data()!
      assert.equal(meter.meterNumber, 'MTR-999002')
    })
  })
  test('rejected: the call centre adding a meter', async () => {
    await assertFails(addMeter(dbAs('cc1', 'call_centre'), 'cc1'))
  })
  test('rejected: linking an account to a meter that belongs to another account', async () => {
    await assertFails(
      updateDoc(
        meterQueries.account(dbAs('bill1', 'billing'), 'acc-new'),
        linkMeterUpdate('sample-meter-3', serverTimestamp()),
      ),
    )
  })
})

describe('Meter status', () => {
  test('billing can mark a meter faulty; a technician cannot', async () => {
    await assertSucceeds(
      updateDoc(
        meterQueries.meter(dbAs('bill1', 'billing'), METER.id),
        meterStatusUpdate('FAULTY', serverTimestamp()),
      ),
    )
    await assertFails(
      updateDoc(
        meterQueries.meter(dbAs('tech1', 'technician'), METER.id),
        meterStatusUpdate('ACTIVE', serverTimestamp()),
      ),
    )
  })
})
