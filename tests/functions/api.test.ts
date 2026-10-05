import { describe, expect, it, vi } from 'vitest'
vi.mock('firebase-functions/logger', () => ({ info: vi.fn(), error: vi.fn() }))
import { publishOutage, sendNotification } from '../../functions/src/routes/communications'
import { assignTicket, updateTicketStatus } from '../../functions/src/routes/tickets'
import { HttpError, type Caller } from '../../functions/src/shared/http'
import { AREAS as SERVER_AREAS } from '../../functions/src/shared/outageRules'
import { createApiHandler, type Route } from '../../functions/src/shared/router'
import { statusProblem, type TicketStatus } from '../../functions/src/shared/ticketRules'
import { ticketPermissions } from '../../src/services/ticketActions'
import { AREAS } from '../../src/types/models'
import type { Role } from '../../src/types/user'

const routes: Record<string, Route> = {
  assignTicket: { handler: assignTicket, roles: 'admin, call_centre', summary: 'Assign' },
  updateTicketStatus: {
    handler: updateTicketStatus,
    roles: 'admin, call_centre, technician',
    summary: 'Status',
  },
  publishOutage: { handler: publishOutage, roles: 'admin, communications', summary: 'Outage' },
  sendNotification: {
    handler: sendNotification,
    roles: 'admin, communications',
    summary: 'Message',
  },
}

/** Sends a request through the real router with a fake signed-in caller (or none). */
async function call(path: string, body: unknown, role?: string, method = 'POST') {
  const auth = async (): Promise<Caller> => {
    if (!role) throw new HttpError(401, 'Sign in to continue.')
    return { uid: `${role}-1`, role: role as Role, token: { uid: `${role}-1` } as Caller['token'] }
  }
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(c: number) {
      this.statusCode = c
      return this
    },
    json(b: unknown) {
      this.body = b
      return this
    },
  }
  await createApiHandler(routes, auth)(
    { path, method, body, get: () => undefined } as never,
    res as never,
  )
  return {
    status: res.statusCode,
    ...(res.body as { success: boolean; message: string; data: unknown }),
  }
}
const key = { idempotencyKey: 'test-key-0001' }
const outage = {
  ...key,
  title: 'Main burst',
  description: 'Repairs under way.',
  affectedAreas: ['Matsulu'],
  startTime: '2026-10-01T06:00:00+02:00',
  severity: 'HIGH',
  status: 'ACTIVE',
}

describe('router', () => {
  it('GET /api lists the endpoints with who may call them', async () => {
    const r = await call('/api', undefined, undefined, 'GET')
    expect(r.status).toBe(200)
    expect(r.data).toEqual({
      endpoints: expect.arrayContaining([
        {
          method: 'POST',
          path: '/api/assignTicket',
          roles: 'admin, call_centre',
          summary: 'Assign',
        },
      ]),
    })
  })
  it('unknown endpoints are 404, wrong methods 405, missing sign-in 401', async () => {
    expect((await call('/api/nope', {}, 'admin')).status).toBe(404)
    expect((await call('/api/assignTicket', {}, 'admin', 'GET')).status).toBe(405)
    expect((await call('/api/assignTicket', { ticketId: 't', technicianId: 'x' })).status).toBe(401)
  })
  it('every response has the same shape', async () => {
    const r = await call('/api/nope', {}, 'admin')
    expect(r).toMatchObject({ success: false, message: expect.any(String), data: null })
  })
})

describe('roles are checked before anything else', () => {
  it.each([
    ['/api/assignTicket', 'technician'],
    ['/api/assignTicket', 'customer'],
    ['/api/updateTicketStatus', 'billing'],
    ['/api/publishOutage', 'call_centre'],
    ['/api/sendNotification', 'customer'],
  ])('%s refuses %s with 403', async (path, role) => {
    expect((await call(path, {}, role)).status).toBe(403)
  })
})

describe('input validation (400s, before touching the database)', () => {
  it.each([
    ['/api/assignTicket', { ticketId: 't1' }, 'admin', /technicianId/],
    ['/api/assignTicket', { ticketId: 'a/b', technicianId: 'x' }, 'admin', /not a valid ID/],
    [
      '/api/updateTicketStatus',
      { ticketId: 't1', status: 'DONE' },
      'call_centre',
      /must be one of/,
    ],
    [
      '/api/publishOutage',
      { ...outage, affectedAreas: ['Atlantis'] },
      'communications',
      /Unknown area/,
    ],
    [
      '/api/publishOutage',
      { ...outage, expectedResolution: '2026-09-30T06:00:00+02:00' },
      'communications',
      /after "startTime"/,
    ],
    ['/api/publishOutage', { ...outage, startTime: 'tomorrow' }, 'communications', /ISO date-time/],
    [
      '/api/publishOutage',
      { ...outage, idempotencyKey: undefined },
      'communications',
      /idempotencyKey/,
    ],
    [
      '/api/sendNotification',
      { ...key, title: 'Hi', message: 'Hello', userIds: ['a'], areas: ['Matsulu'] },
      'admin',
      /not both/,
    ],
    [
      '/api/sendNotification',
      { ...key, title: 'Hi', message: 'Hello', userIds: [] },
      'admin',
      /list of user IDs/,
    ],
    [
      '/api/sendNotification',
      { ...key, title: 'Hi', message: 'Hello', areas: ['Matsulu'], link: 'https://evil.example' },
      'admin',
      /in-app path/,
    ],
    [
      '/api/sendNotification',
      { ...key, title: '', message: 'Hello', areas: ['Matsulu'] },
      'admin',
      /"title" is required/,
    ],
  ])('%s %j → 400', async (path, body, role, message) => {
    const r = await call(path, body, role)
    expect(r.status).toBe(400)
    expect(r.message).toMatch(message)
  })
  it('a body that is not a JSON object is a 400', async () => {
    expect((await call('/api/assignTicket', 'ticket please', 'admin')).status).toBe(400)
  })
})

describe('the REST ticket rules agree with what the ticket page offers', () => {
  const statuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED']
  const actions: [keyof ReturnType<typeof ticketPermissions>, TicketStatus][] = [
    ['escalate', 'ESCALATED'],
    ['resolve', 'RESOLVED'],
    ['reopen', 'OPEN'],
    ['startWork', 'IN_PROGRESS'],
  ]
  const cases = (['admin', 'call_centre', 'technician', 'billing', 'customer'] as Role[]).flatMap(
    (role) => statuses.flatMap((status) => [true, false].map((mine) => ({ role, status, mine }))),
  )
  it.each(cases)('$role, ticket $status, assigned to them: $mine', ({ role, status, mine }) => {
    const ticket = {
      status,
      assignedTechnicianId: mine ? 'me' : 'someone',
      assignedTechnicianName: 'X',
    }
    const page = ticketPermissions(role, ticket as never, 'me')
    for (const [action, to] of actions) {
      if (to === status) continue
      const server = statusProblem(role, 'me', ticket, to, 'Replaced the coupling.') === null
      // Escalating or reopening the same status is meaningless; compare real transitions
      expect({ action, server }).toEqual({ action, server: page[action] })
    }
  })
})

it('the server and the app know the same service areas', () => {
  expect([...SERVER_AREAS]).toEqual([...AREAS])
})

import { corsOrigins, extraOrigins } from '../../functions/src/shared/cors'
describe('CORS: which websites may call the API', () => {
  it('reads exact https origins from ALLOWED_ORIGINS, ignoring junk and trailing slashes', () => {
    expect(
      extraOrigins(
        ' https://aqualink.vercel.app/ , http://insecure.example, *.vercel.app, ,https://a-b.vercel.app',
      ),
    ).toEqual(['https://aqualink.vercel.app', 'https://a-b.vercel.app'])
    expect(extraOrigins(undefined)).toEqual([])
  })
  it('always allows the dev server and Firebase Hosting', () => {
    const allowed = (origin: string) =>
      corsOrigins('').some((o) => (typeof o === 'string' ? o === origin : o.test(origin)))
    expect(allowed('http://localhost:5173')).toBe(true)
    expect(allowed('https://aqualink-85d07.web.app')).toBe(true)
    expect(allowed('https://aqualink.vercel.app')).toBe(false)
  })
})
