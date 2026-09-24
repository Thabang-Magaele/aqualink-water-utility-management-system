import { describe, expect, it } from 'vitest'
import {
  planTicketNotifications,
  type TicketSnapshot,
} from '../../functions/src/shared/ticketEvents'

const base: TicketSnapshot = {
  ticketNumber: 'TKT-260924-AB7K',
  customerId: 'custA',
  type: 'LEAK',
  area: 'KaNyamazane',
  location: '14 Mahlangu Street',
  status: 'OPEN',
  assignedTechnicianId: null,
  assignedTechnicianName: null,
  createdBy: 'custA',
}
const who = (drafts: ReturnType<typeof planTicketNotifications>) =>
  drafts.map((d) => `${d.userId}: ${d.title}`)

describe('planTicketNotifications', () => {
  it('new report: confirms to the customer and alerts the call centre and admins', () => {
    const drafts = planTicketNotifications('t1', null, base, ['cc1', 'cc2', 'admin1'])
    expect(who(drafts)).toEqual([
      'custA: Report received',
      'cc1: New leak report',
      'cc2: New leak report',
      'admin1: New leak report',
    ])
    expect(drafts[0]).toMatchObject({
      link: '/customer/tickets/t1',
      relatedId: 't1',
      type: 'TICKET',
    })
    expect(drafts[1]).toMatchObject({
      link: '/staff/tickets/t1',
      message: 'TKT-260924-AB7K in KaNyamazane: 14 Mahlangu Street',
    })
  })

  it('does not alert the agent who logged the report themselves', () => {
    expect(
      who(planTicketNotifications('t1', null, { ...base, createdBy: 'cc1' }, ['cc1', 'cc2'])),
    ).toEqual(['custA: Report received', 'cc2: New leak report'])
  })

  it('assignment: tells the technician (with a field link) and the customer', () => {
    const after = { ...base, assignedTechnicianId: 'tech1', assignedTechnicianName: 'Bongani Dube' }
    const drafts = planTicketNotifications('t1', base, after)
    expect(who(drafts)).toEqual(['tech1: New job assigned', 'custA: Technician assigned'])
    expect(drafts[0].link).toBe('/staff/field/t1')
    expect(drafts[1].message).toBe('Bongani Dube has been assigned to your report TKT-260924-AB7K.')
  })

  it('status changes: started, escalated, resolved and reopened reach the customer', () => {
    const assigned = {
      ...base,
      assignedTechnicianId: 'tech1',
      assignedTechnicianName: 'Bongani Dube',
    }
    const step = (from: string, to: string) =>
      who(planTicketNotifications('t1', { ...assigned, status: from }, { ...assigned, status: to }))
    expect(step('OPEN', 'IN_PROGRESS')).toEqual(['custA: Work has started'])
    expect(step('OPEN', 'ESCALATED')).toEqual(['custA: Report escalated'])
    expect(step('IN_PROGRESS', 'RESOLVED')).toEqual(['custA: Issue resolved'])
    expect(step('RESOLVED', 'OPEN')).toEqual(['custA: Report reopened'])
  })

  it('stays quiet for changes customers don’t need to hear about', () => {
    expect(planTicketNotifications('t1', base, { ...base, location: 'corrected address' })).toEqual(
      [],
    )
    expect(planTicketNotifications('t1', base, null)).toEqual([]) // deleted
    const assigned = { ...base, assignedTechnicianId: 'tech1', assignedTechnicianName: 'B' }
    expect(planTicketNotifications('t1', assigned, { ...assigned, status: 'OPEN' })).toEqual([])
  })
})
