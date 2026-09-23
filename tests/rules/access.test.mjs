/**
 * Phase 2 access-control proof. Runs against the Firestore emulator:
 *
 *   npm run test:rules
 *
 * Each test signs in as a role (via a fake custom claim, exactly as the real
 * token would carry it) and checks that Firestore allows or rejects the operation.
 */
import { after, before, beforeEach, describe, test } from 'node:test'
import { readFileSync } from 'node:fs'
import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'

let env
const now = () => firebase.firestore.FieldValue.serverTimestamp()

/** Firestore client signed in as `uid` with the given role claim (omit role for none). */
const as = (uid, role) =>
  env
    .authenticatedContext(
      uid,
      role ? { role, email: `${uid}@aqualink.demo` } : { email: `${uid}@aqualink.demo` },
    )
    .firestore()

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aqualink',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  // Seed data with rules switched off
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db.doc('customers/custA').set({ name: 'Customer A' })
    await db.doc('customers/custB').set({ name: 'Customer B' })
    await db.doc('accounts/accA').set({ customerId: 'custA', balance: 120 })
    await db.doc('accounts/accB').set({ customerId: 'custB', balance: 560 })
    await db.doc('invoices/invA').set({ customerId: 'custA', accountId: 'accA', amount: 120 })
    await db.doc('payments/payA').set({ customerId: 'custA', invoiceId: 'invA', amount: 120 })
    await db.doc('assets/res1').set({ name: 'Kanyamazane Reservoir', type: 'RESERVOIR' })
    await db.doc('auditLogs/log1').set({ action: 'USER_LOGIN', userId: 'admin1' })
    await db
      .doc('tickets/t1')
      .set({ customerId: 'custA', status: 'OPEN', assignedTechnicianId: 'tech1' })
  })
})

after(async () => {
  await env?.cleanup()
})

describe('Technician cannot read billing data', () => {
  test('cannot read invoices', () =>
    assertFails(as('tech1', 'technician').doc('invoices/invA').get()))
  test('cannot read payments', () =>
    assertFails(as('tech1', 'technician').doc('payments/payA').get()))
  test('cannot read account balances', () =>
    assertFails(as('tech1', 'technician').doc('accounts/accA').get()))
  test('can read their assigned ticket', () =>
    assertSucceeds(as('tech1', 'technician').doc('tickets/t1').get()))
  test('cannot read a ticket assigned to someone else', () =>
    assertFails(as('tech2', 'technician').doc('tickets/t1').get()))
})

describe('Billing cannot modify infrastructure', () => {
  test('cannot create an asset', () =>
    assertFails(as('bill1', 'billing').doc('assets/new').set({ name: 'Rogue pipe', type: 'PIPE' })))
  test('cannot edit an asset', () =>
    assertFails(as('bill1', 'billing').doc('assets/res1').update({ status: 'OFFLINE' })))
  test('can read invoices (control)', () =>
    assertSucceeds(as('bill1', 'billing').doc('invoices/invA').get()))
  test('asset manager can edit an asset (control)', () =>
    assertSucceeds(as('am1', 'asset_manager').doc('assets/res1').update({ status: 'OFFLINE' })))
})

describe("Customer cannot access another customer's account", () => {
  test("cannot read another customer's account", () =>
    assertFails(as('custA', 'customer').doc('accounts/accB').get()))
  test("cannot read another customer's record", () =>
    assertFails(as('custA', 'customer').doc('customers/custB').get()))
  test('can read their own account', () =>
    assertSucceeds(as('custA', 'customer').doc('accounts/accA').get()))
  test('can list only their own accounts', () =>
    assertSucceeds(
      as('custA', 'customer').collection('accounts').where('customerId', '==', 'custA').get(),
    ))
  test('cannot list all accounts', () =>
    assertFails(as('custA', 'customer').collection('accounts').get()))
  test('a user with no role claim is treated as a customer', () =>
    assertSucceeds(as('custA').doc('accounts/accA').get()))
})

describe('Admin can access administrative data', () => {
  test('admin can read audit logs', () =>
    assertSucceeds(as('admin1', 'admin').doc('auditLogs/log1').get()))
  test('admin can read all users', () =>
    assertSucceeds(as('admin1', 'admin').collection('users').get()))
  test('non-admin staff cannot read audit logs', () =>
    assertFails(as('cc1', 'call_centre').doc('auditLogs/log1').get()))
  test('nobody can write audit logs from the browser', () =>
    assertFails(as('admin1', 'admin').doc('auditLogs/x').set({ action: 'FAKE' })))
})

describe('Roles cannot be self-assigned', () => {
  test('cannot register with an admin role', () =>
    assertFails(
      as('newUser').doc('users/newUser').set({
        uid: 'newUser',
        displayName: 'Sneaky',
        email: 'newUser@aqualink.demo',
        phone: '',
        role: 'admin',
        createdAt: now(),
        updatedAt: now(),
      }),
    ))
  test('cannot change own role on an existing profile', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.firestore().doc('users/custA').set({
        uid: 'custA',
        displayName: 'A',
        email: 'custA@aqualink.demo',
        phone: '',
        role: 'customer',
      }),
    )
    await assertFails(as('custA', 'customer').doc('users/custA').update({ role: 'admin' }))
  })
})
