import { describe, expect, it } from 'vitest'
import type { Role } from '../types/user'
import {
  addNote,
  assignTechnician,
  changePriority,
  changeStatus,
  linkAsset,
  newTicket,
  ticketPermissions,
  ticketProgress,
  type Actor,
} from './ticketActions'

const TS = { serverTimestamp: true }
const customer: Actor = { uid: 'custA', name: 'Thandi Mokoena', role: 'customer' }
const agent: Actor = { uid: 'cc1', name: 'Pieter Nel', role: 'call_centre' }
const tech: Actor = { uid: 'tech1', name: 'Bongani Dube', role: 'technician' }
const open = {
  status: 'OPEN',
  priority: 'MEDIUM',
  assignedTechnicianId: null,
  assignedTechnicianName: null,
  assetId: null,
} as const

describe('newTicket', () => {
  const input = {
    customerId: 'custA',
    customerName: ' Thandi Mokoena ',
    accountId: 'acc-1',
    type: 'LEAK',
    priority: 'MEDIUM',
    location: ' 14 Mahlangu Street ',
    area: 'KaNyamazane',
    description: ' Leak at the gate ',
  } as const
  it('starts OPEN and unassigned, trims text, and records who reported it', () => {
    const { ticket, history } = newTicket(input, customer, TS, 'TKT-260924-ABCD')
    expect(ticket).toMatchObject({
      ticketNumber: 'TKT-260924-ABCD',
      status: 'OPEN',
      assignedTechnicianId: null,
      assetId: null,
      resolvedAt: null,
      createdBy: 'custA',
      customerName: 'Thandi Mokoena',
      location: '14 Mahlangu Street',
      description: 'Leak at the gate',
      createdAt: TS,
      updatedAt: TS,
    })
    expect(history).toEqual({
      fromStatus: null,
      toStatus: 'OPEN',
      note: 'Reported via the customer portal.',
      changedBy: 'custA',
      changedByName: 'Thandi Mokoena',
      createdAt: TS,
    })
  })
  it('notes when the call centre logs it for the customer', () => {
    expect(newTicket(input, agent, TS).history.note).toBe(
      'Logged by Pieter Nel on the customer’s behalf.',
    )
  })
  it('generates a readable ticket number', () => {
    expect(newTicket(input, customer, TS).ticket.ticketNumber).toMatch(
      /^TKT-\d{6}-[2-9A-HJ-NP-Z]{4}$/,
    )
  })
  it('writes exactly the fields the security rules expect', () => {
    expect(Object.keys(newTicket(input, customer, TS).ticket).sort()).toEqual([
      'accountId',
      'area',
      'assetId',
      'assignedTechnicianId',
      'assignedTechnicianName',
      'createdAt',
      'createdBy',
      'customerId',
      'customerName',
      'description',
      'location',
      'priority',
      'resolvedAt',
      'status',
      'ticketNumber',
      'type',
      'updatedAt',
    ])
  })
})

describe('changes', () => {
  it('assigns, and describes a reassignment', () => {
    expect(assignTechnician(open, { uid: 'tech1', name: 'Bongani Dube' }, agent, TS)).toEqual({
      update: {
        assignedTechnicianId: 'tech1',
        assignedTechnicianName: 'Bongani Dube',
        updatedAt: TS,
      },
      history: expect.objectContaining({
        note: 'Assigned to Bongani Dube.',
        fromStatus: null,
        toStatus: null,
      }),
    })
    const reassigned = assignTechnician(
      { ...open, assignedTechnicianId: 'tech1', assignedTechnicianName: 'Bongani Dube' },
      { uid: 'tech2', name: 'Lwazi Nkosi' },
      agent,
      TS,
      'Closer to site.',
    )
    expect(reassigned.history?.note).toBe(
      'Reassigned from Bongani Dube to Lwazi Nkosi. Closer to site.',
    )
  })
  it('sets resolvedAt only when resolving, and clears it otherwise', () => {
    expect(changeStatus(open, 'RESOLVED', tech, TS, 'Pipe replaced').update).toEqual({
      status: 'RESOLVED',
      updatedAt: TS,
      resolvedAt: TS,
    })
    expect(changeStatus({ ...open, status: 'RESOLVED' }, 'OPEN', agent, TS).update).toEqual({
      status: 'OPEN',
      updatedAt: TS,
      resolvedAt: null,
    })
    expect(changeStatus(open, 'IN_PROGRESS', tech, TS).history).toMatchObject({
      fromStatus: 'OPEN',
      toStatus: 'IN_PROGRESS',
      note: 'Work started.',
    })
  })
  it('records priority changes in words', () => {
    expect(changePriority(open, 'CRITICAL', agent, TS).history?.note).toBe(
      'Priority changed from Medium to Critical.',
    )
  })
  it('asset managers link assets without writing history; the call centre with', () => {
    expect(
      linkAsset(
        { id: 'a1', name: 'Hilltop Reservoir' },
        { uid: 'am1', name: 'A', role: 'asset_manager' },
        TS,
      ).history,
    ).toBeNull()
    expect(linkAsset({ id: 'a1', name: 'Hilltop Reservoir' }, agent, TS).history?.note).toBe(
      'Linked to asset Hilltop Reservoir.',
    )
  })
  it('notes don’t touch the ticket and are capped in length', () => {
    const change = addNote('x'.repeat(2500), tech, TS)
    expect(change.update).toBeNull()
    expect(change.history?.note).toHaveLength(2000)
  })
})

describe('ticketPermissions', () => {
  const allowed = (role: Role, t: Parameters<typeof ticketPermissions>[1], uid = 'someone') =>
    Object.entries(ticketPermissions(role, t, uid))
      .filter(([, v]) => v)
      .map(([k]) => k)
      .sort()

  it('call centre and admin run the desk on open tickets', () => {
    for (const role of ['call_centre', 'admin'] as const) {
      expect(allowed(role, open)).toEqual([
        'addNote',
        'assign',
        'changePriority',
        'escalate',
        'linkAsset',
        'resolve',
      ])
    }
  })
  it('resolved tickets can only be reopened or annotated', () => {
    expect(allowed('call_centre', { ...open, status: 'RESOLVED' })).toEqual(['addNote', 'reopen'])
  })
  it('the assigned technician starts work, then resolves; others get nothing', () => {
    const mine = { ...open, assignedTechnicianId: 'tech1' }
    expect(allowed('technician', mine, 'tech1')).toEqual(['addNote', 'startWork'])
    expect(allowed('technician', { ...mine, status: 'IN_PROGRESS' }, 'tech1')).toEqual([
      'addNote',
      'resolve',
    ])
    expect(allowed('technician', { ...mine, status: 'IN_PROGRESS' }, 'tech2')).toEqual([])
    expect(allowed('technician', { ...mine, status: 'RESOLVED' }, 'tech1')).toEqual(['addNote'])
  })
  it('asset managers only link assets; billing and customers get nothing', () => {
    expect(allowed('asset_manager', open)).toEqual(['linkAsset'])
    expect(allowed('billing', open)).toEqual([])
    expect(allowed('customer', open)).toEqual([])
    expect(allowed('call_centre', open)).not.toContain('startWork')
  })
})

describe('ticketProgress', () => {
  const states = (t: Parameters<typeof ticketProgress>[0]) => ticketProgress(t).map((s) => s.state)
  it('walks through the four customer-facing steps', () => {
    expect(states({ status: 'OPEN', assignedTechnicianId: null })).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
    expect(states({ status: 'OPEN', assignedTechnicianId: 't' })).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
    ])
    expect(states({ status: 'IN_PROGRESS', assignedTechnicianId: 't' })).toEqual([
      'done',
      'done',
      'current',
      'upcoming',
    ])
    expect(states({ status: 'RESOLVED', assignedTechnicianId: 't' })).toEqual([
      'done',
      'done',
      'done',
      'current',
    ])
  })
  it('treats an escalated, unassigned ticket as still at "Reported"', () => {
    expect(states({ status: 'ESCALATED', assignedTechnicianId: null })[0]).toBe('current')
  })
})

describe('placeLabel', async () => {
  const { placeLabel } = await import('../utils/ticketDisplay')
  it('does not repeat the area when the address already names it', () => {
    expect(placeLabel({ location: '14 Mahlangu Street, KaNyamazane', area: 'KaNyamazane' })).toBe(
      '14 Mahlangu Street, KaNyamazane',
    )
    expect(placeLabel({ location: 'Corner of Main and Kruger', area: 'Matsulu' })).toBe(
      'Corner of Main and Kruger, Matsulu',
    )
  })
})
