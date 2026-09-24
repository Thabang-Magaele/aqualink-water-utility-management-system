/**
 * Proves the customer-management screens only run queries the rules allow,
 * and that the rules refuse exactly the sections each role doesn't see.
 * Uses the SAME query builders and update payload as the app
 * (src/services/customerQueries.ts).
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
import { getDoc, getDocs, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore'
import { buildSampleData } from '../../scripts/sample-data'
import {
  customerQueries,
  customerSectionsFor,
  customerUpdate,
} from '../../src/services/customerQueries'
import { STAFF_ROLES, type Role } from '../../src/types/user'

let env: RulesTestEnvironment
const CUSTOMER = 'custA' // Thandi in the sample data: accounts, invoices, payments and tickets

function dbFor(role: Role): Firestore {
  const uid = `${role}-user`
  return env
    .authenticatedContext(uid, { role, email: `${uid}@aqualink.demo` })
    .firestore() as unknown as Firestore
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
    await batch.commit()
  })
})

after(async () => {
  await env?.cleanup()
})

const DIRECTORY_ROLES: Role[] = ['admin', 'call_centre', 'billing']

describe('Customer directory and detail page', () => {
  for (const role of DIRECTORY_ROLES) {
    test(`${role}: directory, customer, accounts and meters are allowed`, async () => {
      const db = dbFor(role)
      const customers = await assertSucceeds(getDocs(customerQueries.allCustomers(db)))
      assert.equal(customers.size, 3)
      await assertSucceeds(getDocs(customerQueries.allAccounts(db)))
      const customer = await assertSucceeds(getDoc(customerQueries.customer(db, CUSTOMER)))
      assert.equal(customer.data()?.name, 'Thandi Mokoena')
      const accounts = await assertSucceeds(getDocs(customerQueries.accounts(db, CUSTOMER)))
      assert.equal(accounts.size, 2)
      await assertSucceeds(getDocs(customerQueries.meters(db, CUSTOMER)))
    })

    test(`${role}: the rules agree with which history sections the page shows`, async () => {
      const db = dbFor(role)
      const sections = customerSectionsFor(role)
      const check = async (visible: boolean, run: Promise<unknown>) =>
        visible ? assertSucceeds(run) : assertFails(run)
      await check(sections.invoices, getDocs(customerQueries.invoices(db, CUSTOMER)))
      await check(sections.payments, getDocs(customerQueries.payments(db, CUSTOMER)))
      await check(sections.tickets, getDocs(customerQueries.tickets(db, CUSTOMER)))
    })
  }

  for (const role of STAFF_ROLES.filter((r) => !DIRECTORY_ROLES.includes(r))) {
    test(`${role}: refused the customer directory and records`, async () => {
      const db = dbFor(role)
      await assertFails(getDocs(customerQueries.allCustomers(db)))
      await assertFails(getDocs(customerQueries.allAccounts(db)))
      await assertFails(getDoc(customerQueries.customer(db, CUSTOMER)))
    })
  }

  test('a customer cannot browse the directory', async () => {
    const db = env
      .authenticatedContext('sample-cust-2', { email: 'sipho@aqualink.demo' })
      .firestore() as unknown as Firestore
    await assertFails(getDocs(customerQueries.allCustomers(db)))
    await assertFails(getDoc(customerQueries.customer(db, CUSTOMER)))
  })
})

describe('Editing customer details (the exact payload the app writes)', () => {
  const input = {
    name: ' Thandi Mokoena-Zulu ',
    email: 'Thandi.Z@Example.com',
    phone: '072 555 0101',
    address: '14 Mahlangu Street, KaNyamazane',
    area: 'KaNyamazane' as const,
  }

  for (const role of STAFF_ROLES) {
    const allowed = customerSectionsFor(role).edit
    test(`${role}: ${allowed ? 'can' : 'cannot'} save changes`, async () => {
      const db = dbFor(role)
      const write = updateDoc(
        customerQueries.customer(db, CUSTOMER),
        customerUpdate(input, serverTimestamp()),
      )
      if (allowed) await assertSucceeds(write)
      else await assertFails(write)
    })
  }

  test('an unknown area is refused even for the call centre', async () => {
    const db = dbFor('call_centre')
    await assertFails(
      updateDoc(
        customerQueries.customer(db, CUSTOMER),
        customerUpdate({ ...input, area: 'Atlantis' as unknown as 'Matsulu' }, serverTimestamp()),
      ),
    )
  })
})
