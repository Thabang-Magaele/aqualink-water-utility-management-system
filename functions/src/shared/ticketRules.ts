/**
 * Who may assign tickets and change their status, as REST rules.
 * Mirrors ticketPermissions() in src/services/ticketActions.ts (what the ticket page
 * offers) and firestore.rules (what the database accepts). Pure; unit-tested.
 */
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED'
export const TICKET_STATUSES: readonly TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'ESCALATED',
  'RESOLVED',
]
/** The customer reads the resolution summary, so it must say something. */
export const RESOLVE_NOTE_MIN = 10
export const NOTE_MAX = 2000

export interface TicketFacts {
  status: TicketStatus
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
}

const isDesk = (role: string) => role === 'admin' || role === 'call_centre'

/** Null if allowed, otherwise [HTTP status, message]. */
export function assignProblem(
  role: string,
  ticket: TicketFacts,
  technician: { role?: string } | null,
): [number, string] | null {
  if (!isDesk(role)) return [403, 'Only the call centre and administrators can assign tickets.']
  if (ticket.status === 'RESOLVED')
    return [409, 'This ticket is resolved. Reopen it before assigning it.']
  if (!technician) return [404, 'That technician does not exist.']
  if (technician.role !== 'technician') return [400, 'Tickets can only be assigned to technicians.']
  return null
}

export function statusProblem(
  role: string,
  uid: string,
  ticket: TicketFacts,
  to: TicketStatus,
  note: string,
): [number, string] | null {
  const from = ticket.status
  if (from === to) return [409, `The ticket is already ${to.toLowerCase().replace('_', ' ')}.`]
  if (to === 'RESOLVED' && note.trim().length < RESOLVE_NOTE_MIN)
    return [
      400,
      `Say what was done (at least ${RESOLVE_NOTE_MIN} characters); the customer will read it.`,
    ]

  if (isDesk(role)) {
    if (to === 'ESCALATED' && (from === 'OPEN' || from === 'IN_PROGRESS')) return null
    if (to === 'RESOLVED') return null
    if (to === 'OPEN' && from === 'RESOLVED') return null
    return [
      409,
      `The call centre can escalate, resolve or reopen a ticket, not move it from ${from} to ${to}.`,
    ]
  }
  if (role === 'technician') {
    if (ticket.assignedTechnicianId !== uid)
      return [403, 'You can only update jobs assigned to you.']
    if (to === 'IN_PROGRESS' && (from === 'OPEN' || from === 'ESCALATED')) return null
    if (to === 'RESOLVED' && from === 'IN_PROGRESS') return null
    return [
      409,
      from === 'RESOLVED'
        ? 'A resolved job can only be reopened by the call centre.'
        : 'Start work on the job before resolving it.',
    ]
  }
  return [403, 'You do not have permission to change ticket status.']
}

/** History wording, identical to the ticket page's. */
export function assignmentNote(ticket: TicketFacts, technicianName: string, note: string): string {
  const text = ticket.assignedTechnicianId
    ? `Reassigned from ${ticket.assignedTechnicianName ?? 'another technician'} to ${technicianName}.`
    : `Assigned to ${technicianName}.`
  return note.trim() ? `${text} ${note.trim()}` : text
}

export function statusNote(to: TicketStatus, note: string): string {
  return (
    note.trim() ||
    {
      OPEN: 'Reopened.',
      IN_PROGRESS: 'Work started.',
      ESCALATED: 'Escalated for priority attention.',
      RESOLVED: 'Resolved.',
    }[to]
  )
}
