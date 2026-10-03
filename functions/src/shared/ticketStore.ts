/**
 * REST versions of the ticket page's "assign" and "change status" actions.
 * Same rules (ticketRules.ts), same data written (ticket + history entry, in one
 * transaction), so the ticket trigger sends the same notifications either way.
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { callerName } from './callers'
import { HttpError, type Caller } from './http'
import {
  assignmentNote,
  assignProblem,
  statusNote,
  statusProblem,
  type TicketFacts,
  type TicketStatus,
} from './ticketRules'

function facts(data: FirebaseFirestore.DocumentData): TicketFacts {
  return {
    status: data.status,
    assignedTechnicianId: data.assignedTechnicianId ?? null,
    assignedTechnicianName: data.assignedTechnicianName ?? null,
  }
}

export async function assignTicket(
  input: { ticketId: string; technicianId: string; note: string },
  caller: Caller,
) {
  const db = getFirestore()
  const ticketRef = db.doc(`tickets/${input.ticketId}`)
  return db.runTransaction(async (tx) => {
    const [ticket, tech] = await Promise.all([
      tx.get(ticketRef),
      tx.get(db.doc(`users/${input.technicianId}`)),
    ])
    if (!ticket.exists) throw new HttpError(404, 'That ticket does not exist.')
    const t = facts(ticket.data()!)
    const problem = assignProblem(caller.role, t, tech.exists ? tech.data()! : null)
    if (problem) throw new HttpError(...problem)
    const technicianName = (tech.get('displayName') as string) || (tech.get('email') as string)
    const result = {
      ticketId: input.ticketId,
      status: t.status,
      assignedTechnicianId: input.technicianId,
      assignedTechnicianName: technicianName,
    }
    if (t.assignedTechnicianId === input.technicianId) return { ...result, changed: false }

    const name = await callerName(caller, tx)
    tx.update(ticketRef, {
      assignedTechnicianId: input.technicianId,
      assignedTechnicianName: technicianName,
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.set(ticketRef.collection('ticketHistory').doc(), {
      fromStatus: null,
      toStatus: null,
      note: assignmentNote(t, technicianName, input.note),
      changedBy: caller.uid,
      changedByName: name,
      createdAt: FieldValue.serverTimestamp(),
    })
    return { ...result, changed: true }
  })
}

export async function updateTicketStatus(
  input: { ticketId: string; status: TicketStatus; note: string },
  caller: Caller,
) {
  const db = getFirestore()
  const ticketRef = db.doc(`tickets/${input.ticketId}`)
  return db.runTransaction(async (tx) => {
    const ticket = await tx.get(ticketRef)
    if (!ticket.exists) throw new HttpError(404, 'That ticket does not exist.')
    const t = facts(ticket.data()!)
    const problem = statusProblem(caller.role, caller.uid, t, input.status, input.note)
    if (problem) throw new HttpError(...problem)

    const name = await callerName(caller, tx)
    const now = FieldValue.serverTimestamp()
    tx.update(ticketRef, {
      status: input.status,
      updatedAt: now,
      resolvedAt: input.status === 'RESOLVED' ? now : null,
    })
    tx.set(ticketRef.collection('ticketHistory').doc(), {
      fromStatus: t.status,
      toStatus: input.status,
      note: statusNote(input.status, input.note),
      changedBy: caller.uid,
      changedByName: name,
      createdAt: now,
    })
    return { ticketId: input.ticketId, from: t.status, status: input.status }
  })
}
