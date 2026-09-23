/**
 * AquaLink security-rules tests (Phase 5). Runs against the Firestore emulator:
 *
 *   npm run test:rules
 *
 * Every test starts from the real sample dataset (scripts/sample-data.ts), with:
 *   custA   = demo customer (Thandi): owns sample-acc-1, sample-acc-2, tickets 1 & 3
 *   sample-cust-2 = another customer (Sipho): owns sample-acc-3, ticket 2
 *   tech1   = technician assigned to tickets 2 and 3; tech2 = unassigned technician
 *
 * "Rejected" tests prove unauthorized access fails; "allowed" tests prove the
 * app's legitimate writes still work, so the rules aren't just denying everything.
 */
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import { buildSampleData } from '../../scripts/sample-data'

type Db = firebase.firestore.Firestore
let env: RulesTestEnvironment

const now = () => firebase.firestore.FieldValue.serverTimestamp()
const past = (days: number) => new Date(Date.now() - days * 86_400_000)
const future = (days: number) => new Date(Date.now() + days * 86_400_000)

/** Firestore client signed in as `uid`, with an optional role claim (none = customer). */
function as(uid: string, role?: string): Db {
  const claims: Record<string, string> = { email: `${uid}@aqualink.demo` }
  if (role) claims.role = role
  return env.authenticatedContext(uid, claims).firestore() as unknown as Db
}
const anon = (): Db => env.unauthenticatedContext().firestore() as unknown as Db

/** Expect the operation to be allowed (return type kept void for node:test). */
async function allowed(operation: Promise<unknown>): Promise<void> {
  await assertSucceeds(operation)
}
/** Expect the operation to be rejected by the rules. */
async function rejected(operation: Promise<unknown>): Promise<void> {
  await assertFails(operation)
}

async function seeded(path: string): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {}
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await ctx.firestore().doc(path).get()).data() ?? {}
  })
  return data
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
    const docs = buildSampleData({
      customerUid: 'custA',
      technicianUid: 'tech1',
      technicianName: 'Bongani Dube',
      staffUid: 'admin1',
    })
    for (const d of docs) batch.set(db.doc(d.path), d.data)
    // Login profiles (role mirrors the claim; used by the "assign only to technicians" check)
    const profile = (uid: string, role: string, name: string) => ({
      uid,
      displayName: name,
      email: `${uid}@aqualink.demo`,
      phone: '',
      role,
      createdAt: past(30),
      updatedAt: past(30),
    })
    batch.set(db.doc('users/custA'), profile('custA', 'customer', 'Thandi Mokoena'))
    batch.set(db.doc('users/tech1'), profile('tech1', 'technician', 'Bongani Dube'))
    batch.set(db.doc('users/tech2'), profile('tech2', 'technician', 'Lwazi Nkosi'))
    batch.set(db.doc('users/bill1'), profile('bill1', 'billing', 'Lerato Billing'))
    await batch.commit()
  })
})

after(async () => {
  await env?.cleanup()
})

// ---------------------------------------------------------------- fixtures
type Fields = Record<string, unknown>

const ticketFor = (o: Fields = {}) => ({
  ticketNumber: 'TKT-260923-AB7K',
  customerId: 'custA',
  accountId: 'sample-acc-1',
  assetId: null,
  type: 'LEAK',
  description: 'Water leaking at the gate.',
  priority: 'MEDIUM',
  status: 'OPEN',
  location: '14 Mahlangu Street, KaNyamazane',
  area: 'KaNyamazane',
  customerName: 'Thandi Mokoena',
  assignedTechnicianId: null,
  assignedTechnicianName: null,
  createdBy: 'custA',
  createdAt: now(),
  updatedAt: now(),
  resolvedAt: null,
  ...o,
})
const historyEntry = (by: string, o: Fields = {}) => ({
  fromStatus: null,
  toStatus: null,
  note: 'Note',
  changedBy: by,
  changedByName: 'Someone',
  createdAt: now(),
  ...o,
})
const asset = (o: Fields = {}) => ({
  code: 'RES-009',
  name: 'Tekwane Reservoir',
  type: 'RESERVOIR',
  location: 'Tekwane North',
  area: 'Tekwane',
  status: 'ACTIVE',
  description: '',
  createdAt: now(),
  updatedAt: now(),
  ...o,
})
const waterTest = (o: Fields = {}) => ({
  assetId: 'sample-asset-wtp',
  assetName: 'Mbombela Water Treatment Works',
  sampleDate: past(1),
  parameter: 'PH',
  result: 7.2,
  unit: 'pH units',
  acceptableMin: 5,
  acceptableMax: 9.7,
  status: 'NORMAL',
  recordedBy: 'wq1',
  createdAt: now(),
  ...o,
})
const outage = (o: Fields = {}) => ({
  title: 'Pipe repair',
  description: 'Supply off during repairs.',
  affectedAreas: ['Matsulu'],
  startTime: future(1),
  expectedResolution: future(2),
  severity: 'MEDIUM',
  status: 'SCHEDULED',
  createdBy: 'comms1',
  createdAt: now(),
  updatedAt: now(),
  ...o,
})
const customer = (o: Fields = {}) => ({
  name: 'Nomvula Sithole',
  email: 'nomvula@example.com',
  phone: '0825550101',
  address: '5 Baobab Street, Kabokweni',
  area: 'Kabokweni',
  accountIds: [],
  createdAt: now(),
  updatedAt: now(),
  ...o,
})
const account = (o: Fields = {}) => ({
  accountNumber: '4100999001',
  customerId: 'custA',
  meterId: null,
  balance: 0,
  status: 'ACTIVE',
  propertyAddress: '14 Mahlangu Street, KaNyamazane',
  area: 'KaNyamazane',
  createdAt: now(),
  updatedAt: now(),
  ...o,
})
const invoiceFor = (o: Fields = {}) => ({
  invoiceNumber: 'INV-202609-3107',
  accountId: 'sample-acc-1',
  customerId: 'custA',
  billingPeriod: '2026-09',
  previousReading: 1300,
  currentReading: 1314.2,
  consumption: 14.2,
  tariffRate: 28.5,
  amount: 404.7,
  status: 'UNPAID',
  dueDate: future(20),
  paidAt: null,
  createdAt: now(),
  ...o,
})
async function readingFor(o: Fields = {}) {
  const meter = await seeded('meters/sample-meter-1')
  return {
    meterId: 'sample-meter-1',
    accountId: 'sample-acc-1',
    customerId: 'custA',
    readingValue: (meter.lastReading as number) + 12.5,
    readingDate: past(0.01),
    recordedBy: 'bill1',
    createdAt: now(),
    ...o,
  }
}
const unpaidInvoicePath = () =>
  buildSampleData({ customerUid: 'custA' }).find(
    (d) => d.path.startsWith('invoices/sample-inv-acc-1') && d.data.status === 'UNPAID',
  )!.path

// ================================================================ READS
describe('Reads: nobody sees data that isn’t theirs', () => {
  test('signed-out users are rejected everywhere', async () => {
    for (const path of [
      'customers/custA',
      'accounts/sample-acc-1',
      'tickets/sample-ticket-1',
      'outageNotices/sample-outage-1',
      'assets/sample-asset-res',
    ]) {
      await rejected(anon().doc(path).get())
    }
  })
  test('technician cannot read billing or customer data', async () => {
    const t = as('tech1', 'technician')
    for (const path of [
      'invoices/sample-inv-acc-1-1',
      'payments/sample-pay-acc-1-1',
      'accounts/sample-acc-1',
      'customers/custA',
      'meters/sample-meter-1',
      'readings/sample-acc-1-r0',
    ]) {
      await rejected(t.doc(path).get())
    }
  })
  test('technician sees only tickets assigned to them', async () => {
    await allowed(as('tech1', 'technician').doc('tickets/sample-ticket-2').get())
    await rejected(as('tech1', 'technician').doc('tickets/sample-ticket-1').get())
    await rejected(as('tech2', 'technician').doc('tickets/sample-ticket-2').get())
    await allowed(
      as('tech1', 'technician')
        .collection('tickets')
        .where('assignedTechnicianId', '==', 'tech1')
        .get(),
    )
    await rejected(as('tech1', 'technician').collection('tickets').get())
  })
  test("customer cannot read another customer's records", async () => {
    const c = as('custA')
    for (const path of [
      'customers/sample-cust-2',
      'accounts/sample-acc-3',
      'invoices/sample-inv-acc-3-1',
      'tickets/sample-ticket-2',
      'meters/sample-meter-3',
    ]) {
      await rejected(c.doc(path).get())
    }
    await rejected(c.collection('invoices').get())
    await rejected(c.collection('invoices').where('customerId', '==', 'sample-cust-2').get())
  })
  test('customer can read their own records (control)', async () => {
    const c = as('custA', 'customer')
    await allowed(c.doc('customers/custA').get())
    await allowed(c.doc('accounts/sample-acc-1').get())
    await allowed(c.collection('invoices').where('customerId', '==', 'custA').get())
    await allowed(c.collection('readings').where('customerId', '==', 'custA').get())
    await allowed(c.collection('notifications').where('userId', '==', 'custA').get())
  })
  test('roles stay in their lane', async () => {
    await rejected(as('bill1', 'billing').doc('tickets/sample-ticket-1').get())
    await rejected(as('comms1', 'communications').doc('customers/custA').get())
    await rejected(as('wq1', 'water_quality').doc('invoices/sample-inv-acc-1-1').get())
    await rejected(as('am1', 'asset_manager').doc('accounts/sample-acc-1').get())
  })
  test('only admins read audit logs and all users', async () => {
    await allowed(as('admin1', 'admin').doc('auditLogs/sample-audit-1').get())
    await allowed(as('admin1', 'admin').collection('users').get())
    await rejected(as('cc1', 'call_centre').doc('auditLogs/sample-audit-1').get())
    await rejected(as('custA').collection('users').get())
  })
  test('ticket history follows the ticket', async () => {
    await allowed(as('custA').collection('tickets/sample-ticket-3/ticketHistory').get())
    await rejected(as('custA').collection('tickets/sample-ticket-2/ticketHistory').get())
    await allowed(
      as('tech1', 'technician').collection('tickets/sample-ticket-2/ticketHistory').get(),
    )
    await rejected(
      as('tech2', 'technician').collection('tickets/sample-ticket-2/ticketHistory').get(),
    )
  })
})

// ================================================================ ROLES
describe('Roles cannot be self-assigned', () => {
  const registration = (uid: string, role: string) => ({
    uid,
    displayName: 'New Person',
    email: `${uid}@aqualink.demo`,
    phone: '',
    role,
    createdAt: now(),
    updatedAt: now(),
  })
  test('rejected: registering as admin', async () => {
    await rejected(as('newbie').doc('users/newbie').set(registration('newbie', 'admin')))
  })
  test('rejected: changing own role', async () => {
    await rejected(as('custA').doc('users/custA').update({ role: 'admin' }))
  })
  test('allowed: normal customer registration', async () => {
    await allowed(as('newbie').doc('users/newbie').set(registration('newbie', 'customer')))
  })
})

// ================================================================ CUSTOMERS & ACCOUNTS
describe('Customers and accounts', () => {
  test('allowed: call centre creates a customer', async () => {
    await allowed(as('cc1', 'call_centre').collection('customers').add(customer()))
  })
  test('rejected: unknown field, unknown area, or client-chosen date', async () => {
    const cc = as('cc1', 'call_centre')
    await rejected(cc.collection('customers').add(customer({ vip: true })))
    await rejected(cc.collection('customers').add(customer({ area: 'Atlantis' })))
    await rejected(cc.collection('customers').add(customer({ createdAt: past(400) })))
  })
  test('customer may change their own phone only', async () => {
    await allowed(
      as('custA').doc('customers/custA').update({ phone: '0829990000', updatedAt: now() }),
    )
    await rejected(
      as('custA').doc('customers/custA').update({ name: 'Someone Else', updatedAt: now() }),
    )
    await rejected(
      as('custA').doc('customers/sample-cust-2').update({ phone: '0829990000', updatedAt: now() }),
    )
  })
  test('allowed: billing opens an account for an existing customer', async () => {
    await allowed(as('bill1', 'billing').doc('accounts/new-acc').set(account()))
  })
  test('rejected: account for a customer that doesn’t exist', async () => {
    await rejected(
      as('bill1', 'billing')
        .doc('accounts/new-acc')
        .set(account({ customerId: 'ghost' })),
    )
  })
  test('rejected: moving an account to another customer', async () => {
    await rejected(
      as('bill1', 'billing')
        .doc('accounts/sample-acc-1')
        .update({ customerId: 'sample-cust-2', updatedAt: now() }),
    )
  })
  test('rejected: technician or customer changing a balance', async () => {
    await rejected(
      as('tech1', 'technician')
        .doc('accounts/sample-acc-1')
        .update({ balance: 0, updatedAt: now() }),
    )
    await rejected(
      as('custA').doc('accounts/sample-acc-1').update({ balance: 0, updatedAt: now() }),
    )
  })
})

// ================================================================ METER READINGS
describe('Meter readings', () => {
  test('allowed: billing records a valid reading', async () => {
    await allowed(
      as('bill1', 'billing')
        .collection('readings')
        .add(await readingFor()),
    )
  })
  test('rejected: reading lower than the meter’s last value', async () => {
    const meter = await seeded('meters/sample-meter-1')
    await rejected(
      as('bill1', 'billing')
        .collection('readings')
        .add(await readingFor({ readingValue: (meter.lastReading as number) - 1 })),
    )
  })
  test('rejected: future-dated, recorded in someone else’s name, or for the wrong customer', async () => {
    const b = as('bill1', 'billing')
    await rejected(b.collection('readings').add(await readingFor({ readingDate: future(2) })))
    await rejected(b.collection('readings').add(await readingFor({ recordedBy: 'someone-else' })))
    await rejected(b.collection('readings').add(await readingFor({ customerId: 'sample-cust-2' })))
  })
  test('rejected: technician recording, or anyone editing a reading', async () => {
    await rejected(
      as('tech1', 'technician')
        .collection('readings')
        .add(await readingFor({ recordedBy: 'tech1' })),
    )
    await rejected(
      as('bill1', 'billing').doc('readings/sample-acc-1-r0').update({ readingValue: 1 }),
    )
  })
  test('rejected: winding a meter back', async () => {
    await rejected(
      as('bill1', 'billing')
        .doc('meters/sample-meter-1')
        .update({ lastReading: 0, updatedAt: now() }),
    )
  })
})

// ================================================================ INVOICES & PAYMENTS
describe('Invoices and payments', () => {
  test('allowed: billing creates a correct invoice', async () => {
    await allowed(as('bill1', 'billing').collection('invoices').add(invoiceFor()))
  })
  test('rejected: amounts that don’t add up', async () => {
    const b = as('bill1', 'billing')
    await rejected(b.collection('invoices').add(invoiceFor({ amount: 10 })))
    await rejected(b.collection('invoices').add(invoiceFor({ consumption: 1 })))
    await rejected(b.collection('invoices').add(invoiceFor({ currentReading: 1200 })))
  })
  test('rejected: created already PAID, bad period, or for the wrong customer', async () => {
    const b = as('bill1', 'billing')
    await rejected(b.collection('invoices').add(invoiceFor({ status: 'PAID' })))
    await rejected(b.collection('invoices').add(invoiceFor({ billingPeriod: '2026-13' })))
    await rejected(b.collection('invoices').add(invoiceFor({ customerId: 'sample-cust-2' })))
  })
  test('allowed: billing marks an unpaid invoice overdue', async () => {
    await allowed(as('bill1', 'billing').doc(unpaidInvoicePath()).update({ status: 'OVERDUE' }))
  })
  test('rejected: anyone in the browser marking an invoice PAID', async () => {
    await rejected(as('bill1', 'billing').doc(unpaidInvoicePath()).update({ status: 'PAID' }))
    await rejected(as('custA').doc(unpaidInvoicePath()).update({ status: 'PAID' }))
    await rejected(as('admin1', 'admin').doc(unpaidInvoicePath()).update({ status: 'PAID' }))
  })
  test('rejected: creating payments from the browser (Cloud Function only)', async () => {
    const payment = {
      invoiceId: 'sample-inv-acc-1-4',
      accountId: 'sample-acc-1',
      customerId: 'custA',
      amount: 1,
    }
    await rejected(as('custA').collection('payments').add(payment))
    await rejected(as('bill1', 'billing').collection('payments').add(payment))
  })
})

// ================================================================ TICKETS
describe('Tickets: customer reporting', () => {
  test('allowed: customer reports a leak with its first history entry, in one batch', async () => {
    const db = as('custA')
    const ref = db.collection('tickets').doc()
    const batch = db.batch()
    batch.set(ref, ticketFor())
    batch.set(
      ref.collection('ticketHistory').doc(),
      historyEntry('custA', {
        toStatus: 'OPEN',
        note: 'Reported via portal',
        changedByName: 'Thandi Mokoena',
      }),
    )
    await allowed(batch.commit())
  })
  test('rejected: reporting for someone else, or against someone else’s account', async () => {
    await rejected(
      as('custA')
        .collection('tickets')
        .add(ticketFor({ customerId: 'sample-cust-2' })),
    )
    await rejected(
      as('custA')
        .collection('tickets')
        .add(ticketFor({ accountId: 'sample-acc-3' })),
    )
  })
  test('rejected: pre-assigned, pre-resolved, unknown type, or back-dated', async () => {
    const c = as('custA')
    await rejected(
      c
        .collection('tickets')
        .add(ticketFor({ assignedTechnicianId: 'tech1', assignedTechnicianName: 'Bongani Dube' })),
    )
    await rejected(
      c.collection('tickets').add(ticketFor({ status: 'RESOLVED', resolvedAt: now() })),
    )
    await rejected(c.collection('tickets').add(ticketFor({ type: 'ALIENS' })))
    await rejected(c.collection('tickets').add(ticketFor({ createdAt: past(10) })))
  })
})

describe('Tickets: call centre', () => {
  const assign = (tech: string, name: string) => ({
    assignedTechnicianId: tech,
    assignedTechnicianName: name,
    updatedAt: now(),
  })
  test('allowed: assign to a technician', async () => {
    await allowed(
      as('cc1', 'call_centre')
        .doc('tickets/sample-ticket-1')
        .update(assign('tech2', 'Lwazi Nkosi')),
    )
  })
  test('rejected: assign to someone who isn’t a technician', async () => {
    await rejected(
      as('cc1', 'call_centre')
        .doc('tickets/sample-ticket-1')
        .update(assign('bill1', 'Lerato Billing')),
    )
  })
  test('rejected: changing who the ticket belongs to', async () => {
    await rejected(
      as('cc1', 'call_centre')
        .doc('tickets/sample-ticket-1')
        .update({ customerId: 'sample-cust-2', updatedAt: now() }),
    )
  })
  test('allowed: escalate', async () => {
    await allowed(
      as('cc1', 'call_centre')
        .doc('tickets/sample-ticket-1')
        .update({ status: 'ESCALATED', priority: 'HIGH', updatedAt: now() }),
    )
  })
})

describe('Tickets: technician workflow', () => {
  test('allowed: start work, then resolve', async () => {
    const t = as('tech1', 'technician')
    await env.withSecurityRulesDisabled((ctx) =>
      ctx
        .firestore()
        .doc('tickets/sample-ticket-1')
        .update({ assignedTechnicianId: 'tech1', assignedTechnicianName: 'Bongani Dube' }),
    )
    await allowed(
      t.doc('tickets/sample-ticket-1').update({ status: 'IN_PROGRESS', updatedAt: now() }),
    )
    await allowed(
      t
        .doc('tickets/sample-ticket-1')
        .update({ status: 'RESOLVED', resolvedAt: now(), updatedAt: now() }),
    )
  })
  test('rejected: resolving without a resolved time', async () => {
    await rejected(
      as('tech1', 'technician')
        .doc('tickets/sample-ticket-2')
        .update({ status: 'RESOLVED', updatedAt: now() }),
    )
  })
  test('rejected: changing priority, or updating someone else’s job', async () => {
    await rejected(
      as('tech1', 'technician')
        .doc('tickets/sample-ticket-2')
        .update({ priority: 'LOW', updatedAt: now() }),
    )
    await rejected(
      as('tech2', 'technician')
        .doc('tickets/sample-ticket-2')
        .update({ status: 'IN_PROGRESS', updatedAt: now() }),
    )
  })
  test('rejected: reopening a resolved ticket', async () => {
    await rejected(
      as('tech1', 'technician')
        .doc('tickets/sample-ticket-3')
        .update({ status: 'IN_PROGRESS', resolvedAt: null, updatedAt: now() }),
    )
  })
  test('allowed: technician adds a note; rejected: forged author or edits', async () => {
    const t = as('tech1', 'technician')
    await allowed(
      t
        .collection('tickets/sample-ticket-2/ticketHistory')
        .add(historyEntry('tech1', { note: 'Pipe replaced', changedByName: 'Bongani Dube' })),
    )
    await rejected(t.collection('tickets/sample-ticket-2/ticketHistory').add(historyEntry('cc1')))
    await rejected(t.doc('tickets/sample-ticket-2/ticketHistory/h1').update({ note: 'rewritten' }))
  })
  test('rejected: customer adding a status change to history', async () => {
    await rejected(
      as('custA')
        .collection('tickets/sample-ticket-1/ticketHistory')
        .add(historyEntry('custA', { fromStatus: 'OPEN', toStatus: 'RESOLVED' })),
    )
  })
  test('after reassignment the new technician sees the full history', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.firestore().doc('tickets/sample-ticket-2').update({ assignedTechnicianId: 'tech2' }),
    )
    await allowed(
      as('tech2', 'technician').collection('tickets/sample-ticket-2/ticketHistory').get(),
    )
    await rejected(
      as('tech1', 'technician').collection('tickets/sample-ticket-2/ticketHistory').get(),
    )
  })
  test('asset manager may link an existing asset only', async () => {
    const am = as('am1', 'asset_manager')
    await allowed(
      am.doc('tickets/sample-ticket-1').update({ assetId: 'sample-asset-pipe', updatedAt: now() }),
    )
    await rejected(
      am.doc('tickets/sample-ticket-1').update({ assetId: 'no-such-asset', updatedAt: now() }),
    )
    await rejected(
      am
        .doc('tickets/sample-ticket-1')
        .update({ status: 'RESOLVED', resolvedAt: now(), updatedAt: now() }),
    )
  })
})

// ================================================================ INFRASTRUCTURE
describe('Assets', () => {
  test('allowed: asset manager adds an asset', async () => {
    await allowed(as('am1', 'asset_manager').collection('assets').add(asset()))
  })
  test('rejected: billing adds or edits infrastructure', async () => {
    await rejected(as('bill1', 'billing').collection('assets').add(asset()))
    await rejected(
      as('bill1', 'billing')
        .doc('assets/sample-asset-res')
        .update({ status: 'OFFLINE', updatedAt: now() }),
    )
  })
  test('rejected: invalid type or code', async () => {
    await rejected(
      as('am1', 'asset_manager')
        .collection('assets')
        .add(asset({ type: 'SPACESHIP' })),
    )
    await rejected(
      as('am1', 'asset_manager')
        .collection('assets')
        .add(asset({ code: 'reservoir nine' })),
    )
  })
})

describe('Water quality', () => {
  test('allowed: a normal result filed as NORMAL, an abnormal one as ALERT', async () => {
    const wq = as('wq1', 'water_quality')
    await allowed(wq.collection('waterQualityTests').add(waterTest()))
    await allowed(
      wq.collection('waterQualityTests').add(
        waterTest({
          parameter: 'TURBIDITY',
          result: 3.1,
          unit: 'NTU',
          acceptableMin: null,
          acceptableMax: 1,
          status: 'ALERT',
        }),
      ),
    )
  })
  test('rejected: an out-of-range result filed as NORMAL (hiding an alert)', async () => {
    await rejected(
      as('wq1', 'water_quality')
        .collection('waterQualityTests')
        .add(waterTest({ result: 11.5, status: 'NORMAL' })),
    )
  })
  test('rejected: wrong recorder, unknown asset, or another role', async () => {
    const wq = as('wq1', 'water_quality')
    await rejected(
      wq.collection('waterQualityTests').add(waterTest({ recordedBy: 'someone-else' })),
    )
    await rejected(wq.collection('waterQualityTests').add(waterTest({ assetId: 'no-such-asset' })))
    await rejected(
      as('bill1', 'billing')
        .collection('waterQualityTests')
        .add(waterTest({ recordedBy: 'bill1' })),
    )
  })
})

// ================================================================ COMMUNICATIONS
describe('Outage notices and notifications', () => {
  test('allowed: communications publishes a notice; customers can read it', async () => {
    await allowed(as('comms1', 'communications').doc('outageNotices/new').set(outage()))
    await allowed(as('custA').doc('outageNotices/new').get())
  })
  test('rejected: unknown or missing area, or a customer publishing', async () => {
    const comms = as('comms1', 'communications')
    await rejected(comms.collection('outageNotices').add(outage({ affectedAreas: ['Atlantis'] })))
    await rejected(comms.collection('outageNotices').add(outage({ affectedAreas: [] })))
    await rejected(
      as('custA')
        .collection('outageNotices')
        .add(outage({ createdBy: 'custA' })),
    )
  })
  test('recipient may mark a notification read, nothing else', async () => {
    await allowed(as('custA').doc('notifications/sample-note-2').update({ read: true }))
    await rejected(as('custA').doc('notifications/sample-note-2').update({ message: 'changed' }))
    await rejected(as('sample-cust-2').doc('notifications/sample-note-2').update({ read: true }))
  })
  test('rejected: creating notifications or audit logs from the browser', async () => {
    await rejected(
      as('admin1', 'admin')
        .collection('notifications')
        .add({ userId: 'custA', title: 'Fake', read: false }),
    )
    await rejected(as('admin1', 'admin').collection('auditLogs').add({ action: 'FAKE' }))
  })
})
