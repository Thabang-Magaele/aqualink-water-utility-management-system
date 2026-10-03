/**
 * The Phase 13 REST operations against the Firestore emulator: the real server code
 * behind assignTicket, updateTicketStatus, publishOutage and sendNotification.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  getApps,
  getFirestore as adminDb,
  initializeApp,
} from '../../functions/src/shared/adminApp'
import { publishOutage, sendNotification } from '../../functions/src/shared/communicationsStore'
import { HttpError, type Caller } from '../../functions/src/shared/http'
import { parseOutage } from '../../functions/src/shared/outageRules'
import { assignTicket, updateTicketStatus } from '../../functions/src/shared/ticketStore'
import { buildSampleData } from '../../scripts/sample-data'

let env: RulesTestEnvironment
const CUSTOMER = 'custA'
const caller = (uid: string, role: string, name = uid): Caller => ({
  uid,
  role: role as Caller['role'],
  token: { uid, name } as unknown as Caller['token'],
})
const desk = caller('cc1', 'call_centre', 'Pieter Nel')
const tech1 = caller('tech1', 'technician', 'Bongani Dube')
const comms = caller('comms1', 'communications', 'Zodwa Comms')
const read = async (path: string) => (await adminDb().doc(path).get()).data()!
const history = async (ticketId: string) =>
  (
    await adminDb().collection(`tickets/${ticketId}/ticketHistory`).orderBy('createdAt').get()
  ).docs.map((d) => d.data())
const rejects = (p: Promise<unknown>, status: number) =>
  assert.rejects(p, (e: unknown) => e instanceof HttpError && e.status === status)
const profile = (role: string, name: string) => ({
  uid: 'x',
  displayName: name,
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
    for (const d of buildSampleData({
      customerUid: CUSTOMER,
      technicianUid: 'tech1',
      technicianName: 'Bongani Dube',
      staffUid: 'admin1',
    }))
      if (!d.path.startsWith('notifications/')) batch.set(db.doc(d.path), d.data)
    batch.set(db.doc(`users/${CUSTOMER}`), profile('customer', 'Thandi Mokoena'))
    batch.set(db.doc('users/tech1'), profile('technician', 'Bongani Dube'))
    batch.set(db.doc('users/tech2'), profile('technician', 'Lwazi Nkosi'))
    batch.set(db.doc('users/bill1'), profile('billing', 'Lerato Sithole'))
    batch.set(db.doc('users/cc1'), profile('call_centre', 'Pieter Nel'))
    await batch.commit()
  })
})

after(async () => {
  await env?.cleanup()
})

describe('POST /api/assignTicket', () => {
  test('assigns, records history in the same words as the ticket page, and is a no-op the second time', async () => {
    const r = await assignTicket(
      { ticketId: 'sample-ticket-1', technicianId: 'tech2', note: 'Customer home after 2pm.' },
      desk,
    )
    assert.equal(r.changed, true)
    const t = await read('tickets/sample-ticket-1')
    assert.equal(t.assignedTechnicianId, 'tech2')
    assert.equal(t.assignedTechnicianName, 'Lwazi Nkosi')
    const h = (await history('sample-ticket-1')).at(-1)!
    assert.equal(h.note, 'Assigned to Lwazi Nkosi. Customer home after 2pm.')
    assert.equal(h.changedByName, 'Pieter Nel')
    const before = (await history('sample-ticket-1')).length
    assert.equal(
      (await assignTicket({ ticketId: 'sample-ticket-1', technicianId: 'tech2', note: '' }, desk))
        .changed,
      false,
    )
    assert.equal((await history('sample-ticket-1')).length, before)
  })
  test('reassigning says who it moved from', async () => {
    await assignTicket({ ticketId: 'sample-ticket-2', technicianId: 'tech2', note: '' }, desk)
    assert.equal(
      (await history('sample-ticket-2')).at(-1)!.note,
      'Reassigned from Bongani Dube to Lwazi Nkosi.',
    )
  })
  test('refused: a non-technician (400), a resolved ticket (409), unknown ticket or person (404), a technician calling it (403)', async () => {
    await rejects(
      assignTicket({ ticketId: 'sample-ticket-1', technicianId: 'bill1', note: '' }, desk),
      400,
    )
    await rejects(
      assignTicket({ ticketId: 'sample-ticket-3', technicianId: 'tech2', note: '' }, desk),
      409,
    )
    await rejects(assignTicket({ ticketId: 'nope', technicianId: 'tech2', note: '' }, desk), 404)
    await rejects(
      assignTicket({ ticketId: 'sample-ticket-1', technicianId: 'ghost', note: '' }, desk),
      404,
    )
    await rejects(
      assignTicket({ ticketId: 'sample-ticket-1', technicianId: 'tech2', note: '' }, tech1),
      403,
    )
  })
})

describe('POST /api/updateTicketStatus', () => {
  test('a technician starts, then resolves their job; resolvedAt is set and history records both', async () => {
    await assignTicket({ ticketId: 'sample-ticket-1', technicianId: 'tech1', note: '' }, desk)
    await updateTicketStatus(
      { ticketId: 'sample-ticket-1', status: 'IN_PROGRESS', note: '' },
      tech1,
    )
    await updateTicketStatus(
      { ticketId: 'sample-ticket-1', status: 'RESOLVED', note: 'Replaced the leaking stopcock.' },
      tech1,
    )
    const t = await read('tickets/sample-ticket-1')
    assert.equal(t.status, 'RESOLVED')
    assert.ok(t.resolvedAt)
    const [started, resolved] = (await history('sample-ticket-1')).slice(-2)
    assert.deepEqual(
      [started.fromStatus, started.toStatus, started.note],
      ['OPEN', 'IN_PROGRESS', 'Work started.'],
    )
    assert.deepEqual(
      [resolved.toStatus, resolved.note],
      ['RESOLVED', 'Replaced the leaking stopcock.'],
    )
  })
  test('the call centre reopens a resolved ticket and resolvedAt is cleared', async () => {
    await updateTicketStatus({ ticketId: 'sample-ticket-3', status: 'OPEN', note: '' }, desk)
    const t = await read('tickets/sample-ticket-3')
    assert.equal(t.status, 'OPEN')
    assert.equal(t.resolvedAt, null)
  })
  test('refused: resolving without a summary, another technician’s job, skipping "start work", reopening as a technician', async () => {
    await rejects(
      updateTicketStatus({ ticketId: 'sample-ticket-2', status: 'RESOLVED', note: 'done' }, tech1),
      400,
    )
    await rejects(
      updateTicketStatus(
        { ticketId: 'sample-ticket-2', status: 'RESOLVED', note: 'Fixed it properly.' },
        caller('tech2', 'technician'),
      ),
      403,
    )
    await assignTicket({ ticketId: 'sample-ticket-1', technicianId: 'tech1', note: '' }, desk)
    await rejects(
      updateTicketStatus(
        { ticketId: 'sample-ticket-1', status: 'RESOLVED', note: 'Fixed it properly.' },
        tech1,
      ),
      409,
    )
    await rejects(
      updateTicketStatus({ ticketId: 'sample-ticket-3', status: 'OPEN', note: '' }, tech1),
      409,
    )
  })
})

describe('POST /api/publishOutage', () => {
  const body = {
    title: 'Main burst on Marula Road',
    description: 'Repairs under way.',
    affectedAreas: ['Matsulu'],
    startTime: '2026-10-01T06:00:00+02:00',
    expectedResolution: '2026-10-01T15:00:00+02:00',
    severity: 'HIGH',
    status: 'ACTIVE',
  }
  test('creates the notice exactly as the rules expect, once per idempotency key', async () => {
    const r = await publishOutage(parseOutage(body), 'key-00000001', comms)
    assert.equal(r.repeated, false)
    const n = await read(`outageNotices/${r.noticeId}`)
    assert.deepEqual(n.affectedAreas, ['Matsulu'])
    assert.equal(n.createdBy, 'comms1')
    assert.equal(n.startTime.toDate().toISOString(), '2026-10-01T04:00:00.000Z')
    const again = await publishOutage(parseOutage(body), 'key-00000001', comms)
    assert.equal(again.repeated, true)
    assert.equal(again.noticeId, r.noticeId)
  })
})

describe('POST /api/sendNotification', () => {
  test('to named users; repeating the request sends nothing new', async () => {
    const input = {
      key: 'key-00000002',
      title: 'Meter reading on Friday',
      message: 'Please keep your gate unlocked.',
      link: null,
      userIds: [CUSTOMER],
      areas: null,
    }
    assert.deepEqual(await sendNotification(input, comms), {
      recipients: 1,
      sent: 1,
      sentBy: 'comms1',
    })
    assert.equal((await sendNotification(input, comms)).sent, 0)
    const n = await read(`notifications/msg-key-00000002-${CUSTOMER}`)
    assert.equal(n.type, 'SYSTEM')
    assert.equal(n.read, false)
  })
  test('to an area reaches customers with a property there; unknown users are a 404', async () => {
    const area = {
      key: 'key-00000003',
      title: 'Pressure testing',
      message: 'Brief interruptions possible.',
      link: '/customer',
      userIds: null,
      areas: ['Tekwane'],
    }
    assert.equal((await sendNotification(area, comms)).sent, 1) // Thandi, through her Tekwane property
    await rejects(
      sendNotification({ ...area, key: 'key-00000004', userIds: ['ghost'], areas: null }, comms),
      404,
    )
  })
})
