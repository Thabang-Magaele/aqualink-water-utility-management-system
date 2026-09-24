/**
 * The ticket workflow against the security rules (Phase 8).
 *
 * The key test: for every role and every sample ticket, each action the ticket
 * page OFFERS (ticketPermissions) is performed with the exact payload the app
 * writes (ticketActions.ts) and must be accepted. No role is shown a button
 * that would fail with "permission denied".
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
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { buildSampleData } from '../../scripts/sample-data'
import {
  addNote,
  assignTechnician,
  changePriority,
  changeStatus,
  linkAsset,
  newTicket,
  ticketPermissions,
  type Actor,
  type TicketChange,
  type TicketPermissions,
} from '../../src/services/ticketActions'
import { ticketQueries } from '../../src/services/ticketQueries'
import type { Ticket } from '../../src/types/models'
import type { Role } from '../../src/types/user'

let env: RulesTestEnvironment
const ts = () => serverTimestamp()
const SAMPLE = buildSampleData({
  customerUid: 'custA',
  technicianUid: 'tech1',
  technicianName: 'Bongani Dube',
  staffUid: 'admin1',
})
const sampleTicket = (id: string) =>
  ({ id, ...SAMPLE.find((d) => d.path === `tickets/${id}`)!.data }) as unknown as Ticket

const USERS: [string, Role, string][] = [
  ['admin1', 'admin', 'Nomsa Mahlangu'],
  ['cc1', 'call_centre', 'Pieter Nel'],
  ['tech1', 'technician', 'Bongani Dube'],
  ['tech2', 'technician', 'Lwazi Nkosi'],
  ['am1', 'asset_manager', 'Sizwe Asset'],
  ['bill1', 'billing', 'Lerato Sithole'],
  ['custA', 'customer', 'Thandi Mokoena'],
]
const actor = (uid: string): Actor => {
  const [, role, name] = USERS.find(([u]) => u === uid)!
  return { uid, role, name }
}
function dbAs(uid: string): Firestore {
  const { role } = actor(uid)
  const claims: Record<string, string> = { email: `${uid}@aqualink.demo` }
  if (role !== 'customer') claims.role = role
  return env.authenticatedContext(uid, claims).firestore() as unknown as Firestore
}

async function seed() {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const batch = db.batch()
    for (const d of SAMPLE) batch.set(db.doc(d.path), d.data)
    for (const [uid, role, name] of USERS) {
      batch.set(db.doc(`users/${uid}`), {
        uid,
        displayName: name,
        email: `${uid}@aqualink.demo`,
        phone: '',
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
    await batch.commit()
  })
}

/** Writes a TicketChange exactly as ticketService.applyTicketChange does. */
function apply(db: Firestore, ticketId: string, change: TicketChange) {
  const ref = doc(db, 'tickets', ticketId)
  const batch = writeBatch(db)
  if (change.update) batch.update(ref, change.update)
  if (change.history) batch.set(doc(collection(ref, 'ticketHistory')), change.history)
  return batch.commit()
}

/** The change a permitted action produces for this ticket. */
function changeFor(action: keyof TicketPermissions, t: Ticket, who: Actor): TicketChange {
  switch (action) {
    case 'assign':
      return assignTechnician(
        t,
        t.assignedTechnicianId === 'tech1'
          ? { uid: 'tech2', name: 'Lwazi Nkosi' }
          : { uid: 'tech1', name: 'Bongani Dube' },
        who,
        ts(),
      )
    case 'escalate':
      return changeStatus(t, 'ESCALATED', who, ts(), 'Needs a supervisor')
    case 'resolve':
      return changeStatus(t, 'RESOLVED', who, ts(), 'Replaced the damaged section of pipe.')
    case 'reopen':
      return changeStatus(t, 'OPEN', who, ts(), 'Customer says it is leaking again.')
    case 'startWork':
      return changeStatus(t, 'IN_PROGRESS', who, ts())
    case 'changePriority':
      return changePriority(t, t.priority === 'CRITICAL' ? 'LOW' : 'CRITICAL', who, ts())
    case 'linkAsset':
      return linkAsset({ id: 'sample-asset-pipe', name: 'Jacaranda Ave 160 mm main' }, who, ts())
    case 'addNote':
      return addNote('Checked on site.', who, ts())
  }
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aqualink',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})
beforeEach(seed)
after(async () => {
  await env?.cleanup()
})

describe('Every action the ticket page offers is accepted by the rules', () => {
  for (const uid of ['admin1', 'cc1', 'tech1', 'tech2', 'am1', 'bill1']) {
    for (const ticketId of ['sample-ticket-1', 'sample-ticket-2', 'sample-ticket-3']) {
      const t = sampleTicket(ticketId)
      const who = actor(uid)
      const offered = (
        Object.entries(ticketPermissions(who.role, t, uid)) as [keyof TicketPermissions, boolean][]
      )
        .filter(([, allowed]) => allowed)
        .map(([name]) => name)
      test(`${uid} (${who.role}) on ${t.status.toLowerCase()} ${ticketId}: ${offered.join(', ') || 'no actions'}`, async () => {
        for (const action of offered) {
          await seed() // each action starts from the same ticket state
          await assertSucceeds(apply(dbAs(uid), ticketId, changeFor(action, t, who)))
        }
      })
    }
  }
})

describe('Actions the page hides are also refused by the rules', () => {
  const t1 = () => sampleTicket('sample-ticket-1') // OPEN, unassigned, Thandi's
  const t2 = () => sampleTicket('sample-ticket-2') // IN_PROGRESS, tech1, Sipho's
  const t3 = () => sampleTicket('sample-ticket-3') // RESOLVED, tech1, Thandi's
  test('a technician cannot touch a job that isn’t theirs', async () => {
    await assertFails(
      apply(dbAs('tech2'), 'sample-ticket-2', addNote('Not my job', actor('tech2'), ts())),
    )
    await assertFails(
      apply(
        dbAs('tech2'),
        'sample-ticket-2',
        changeStatus(t2(), 'RESOLVED', actor('tech2'), ts(), 'Fixed it'),
      ),
    )
    await assertFails(
      apply(
        dbAs('tech1'),
        'sample-ticket-1',
        changeStatus(t1(), 'IN_PROGRESS', actor('tech1'), ts()),
      ),
    )
  })
  test('a technician cannot reopen, reassign or reprioritise', async () => {
    await assertFails(
      apply(dbAs('tech1'), 'sample-ticket-3', changeStatus(t3(), 'OPEN', actor('tech1'), ts())),
    )
    await assertFails(
      apply(
        dbAs('tech1'),
        'sample-ticket-2',
        assignTechnician(t2(), { uid: 'tech2', name: 'Lwazi Nkosi' }, actor('tech1'), ts()),
      ),
    )
    await assertFails(
      apply(dbAs('tech1'), 'sample-ticket-2', changePriority(t2(), 'LOW', actor('tech1'), ts())),
    )
  })
  test('billing and asset managers cannot run the desk; asset managers cannot write history', async () => {
    await assertFails(
      apply(
        dbAs('bill1'),
        'sample-ticket-1',
        assignTechnician(t1(), { uid: 'tech1', name: 'Bongani Dube' }, actor('bill1'), ts()),
      ),
    )
    await assertFails(
      apply(dbAs('am1'), 'sample-ticket-1', addNote('Asset looks fine', actor('am1'), ts())),
    )
    await assertFails(
      apply(
        dbAs('am1'),
        'sample-ticket-1',
        changeStatus(t1(), 'RESOLVED', actor('am1'), ts(), 'Done here'),
      ),
    )
  })
  test('a customer cannot change their own ticket’s status or assignment', async () => {
    await assertFails(
      apply(
        dbAs('custA'),
        'sample-ticket-1',
        changeStatus(t1(), 'RESOLVED', actor('custA'), ts(), 'Sorted'),
      ),
    )
    await assertFails(
      apply(
        dbAs('custA'),
        'sample-ticket-1',
        assignTechnician(t1(), { uid: 'tech1', name: 'Bongani Dube' }, actor('custA'), ts()),
      ),
    )
  })
})

describe('Reporting a problem (the exact batch the app writes)', () => {
  const input = {
    customerId: 'custA',
    customerName: 'Thandi Mokoena',
    accountId: 'sample-acc-1' as string | null,
    type: 'LEAK' as const,
    priority: 'HIGH' as const,
    location: '14 Mahlangu Street, KaNyamazane',
    area: 'KaNyamazane' as const,
    description: 'Water bubbling up through the tar.',
  }
  function create(db: Firestore, who: Actor, overrides: Partial<typeof input> = {}) {
    const ref = doc(collection(db, 'tickets'))
    const { ticket, history } = newTicket({ ...input, ...overrides }, who, ts())
    const batch = writeBatch(db)
    batch.set(ref, ticket)
    batch.set(doc(collection(ref, 'ticketHistory')), history)
    return batch.commit()
  }
  test('customer: for their own account, and for a street location with no account', async () => {
    await assertSucceeds(create(dbAs('custA'), actor('custA')))
    await assertSucceeds(
      create(dbAs('custA'), actor('custA'), {
        accountId: null,
        location: 'Corner of Main and Kruger',
      }),
    )
  })
  test('customer: not for someone else, and not against someone else’s account', async () => {
    await assertFails(create(dbAs('custA'), actor('custA'), { customerId: 'sample-cust-2' }))
    await assertFails(create(dbAs('custA'), actor('custA'), { accountId: 'sample-acc-3' }))
  })
  test('call centre: for a customer, with the right account only', async () => {
    await assertSucceeds(create(dbAs('cc1'), actor('cc1')))
    await assertFails(create(dbAs('cc1'), actor('cc1'), { customerId: 'sample-cust-2' })) // acc-1 isn't Sipho's
    await assertFails(create(dbAs('bill1'), actor('bill1')))
  })
})

describe('Live lists and lookups used by the workflow', () => {
  test('the queue: call centre, admin and asset manager yes; technician, billing and customers no', async () => {
    for (const uid of ['cc1', 'admin1', 'am1'])
      await assertSucceeds(getDocs(ticketQueries.queue(dbAs(uid))))
    for (const uid of ['tech1', 'bill1', 'custA'])
      await assertFails(getDocs(ticketQueries.queue(dbAs(uid))))
  })
  test('technicians list their own jobs only', async () => {
    const jobs = await assertSucceeds(getDocs(ticketQueries.forTechnician(dbAs('tech1'), 'tech1')))
    assert.equal(jobs.size, 2)
    await assertFails(getDocs(ticketQueries.forTechnician(dbAs('tech2'), 'tech1')))
  })
  test('customers list their own tickets only', async () => {
    const mine = await assertSucceeds(getDocs(ticketQueries.forCustomer(dbAs('custA'), 'custA')))
    assert.equal(mine.size, 2)
    await assertFails(getDocs(ticketQueries.forCustomer(dbAs('custA'), 'sample-cust-2')))
  })
  test('the technician picker: call centre and admin can list technicians; nobody else', async () => {
    const techs = await assertSucceeds(getDocs(ticketQueries.technicians(dbAs('cc1'))))
    assert.deepEqual(techs.docs.map((d) => d.id).sort(), ['tech1', 'tech2'])
    await assertSucceeds(getDocs(ticketQueries.technicians(dbAs('admin1'))))
    for (const uid of ['tech1', 'bill1', 'am1', 'custA'])
      await assertFails(getDocs(ticketQueries.technicians(dbAs(uid))))
  })
  test('the call centre still cannot read non-technician profiles', async () => {
    await assertFails(getDoc(doc(dbAs('cc1'), 'users', 'bill1')))
    await assertFails(getDocs(query(collection(dbAs('cc1'), 'users'))))
  })
  test('the notification bell: own notifications, newest first; mark as read', async () => {
    const db = dbAs('custA')
    const bell = query(
      collection(db, 'notifications'),
      where('userId', '==', 'custA'),
      orderBy('createdAt', 'desc'),
      limit(15),
    )
    const snap = await assertSucceeds(getDocs(bell))
    assert.equal(snap.size, 3)
    await assertSucceeds(updateDoc(doc(db, 'notifications', 'sample-note-2'), { read: true }))
  })
})
