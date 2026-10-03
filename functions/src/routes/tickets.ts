import { requireRole, sendSuccess, type Handler } from '../shared/http'
import { assignTicket as assign, updateTicketStatus as update } from '../shared/ticketStore'
import { NOTE_MAX, TICKET_STATUSES } from '../shared/ticketRules'
import { bodyOf, id, oneOf, text } from '../shared/validate'

/**
 * POST /api/assignTicket   { ticketId, technicianId, note? }      call centre, admin
 * Assigns (or reassigns) a ticket to a technician.
 */
export const assignTicket: Handler = async (req, res, caller) => {
  requireRole(caller, ['admin', 'call_centre'])
  const body = bodyOf(req.body)
  const result = await assign(
    {
      ticketId: id(body, 'ticketId'),
      technicianId: id(body, 'technicianId'),
      note: text(body, 'note', { max: NOTE_MAX, optional: true }),
    },
    caller,
  )
  sendSuccess(
    res,
    result.changed
      ? `Assigned to ${result.assignedTechnicianName}.`
      : 'Already assigned to that technician.',
    result,
  )
}

/**
 * POST /api/updateTicketStatus   { ticketId, status, note? }
 * Call centre / admin: escalate, resolve or reopen. Technicians: start or resolve their own jobs.
 * Resolving needs a note of at least 10 characters (the customer reads it).
 */
export const updateTicketStatus: Handler = async (req, res, caller) => {
  requireRole(caller, ['admin', 'call_centre', 'technician'])
  const body = bodyOf(req.body)
  const result = await update(
    {
      ticketId: id(body, 'ticketId'),
      status: oneOf(body, 'status', TICKET_STATUSES),
      note: text(body, 'note', { max: NOTE_MAX, optional: true }),
    },
    caller,
  )
  sendSuccess(res, `Ticket is now ${result.status.toLowerCase().replace('_', ' ')}.`, result)
}
