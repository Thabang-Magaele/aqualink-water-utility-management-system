/**
 * Every change to a ticket, as plain data.
 *
 * Each builder returns exactly what gets written: the ticket fields and the
 * history entry recorded with it (written together in one batch). They are pure
 * (the timestamp is passed in), so tests/rules/tickets.test.ts writes these same
 * payloads to prove the security rules accept them.
 */
import type { Area, Priority, Ticket, TicketStatus, TicketType } from '../types/models'
import type { Role } from '../types/user'
import { generateReference } from '../utils/domain'

export interface Actor {
  uid: string
  name: string
  role: Role
}

export interface HistoryDraft {
  fromStatus: TicketStatus | null
  toStatus: TicketStatus | null
  note: string
  changedBy: string
  changedByName: string
  createdAt: unknown
}

/** What one action writes. `update` is merged into the ticket; `history` is appended. */
export interface TicketChange {
  update: Record<string, unknown> | null
  history: HistoryDraft | null
}

type TicketState = Pick<
  Ticket,
  'status' | 'priority' | 'assignedTechnicianId' | 'assignedTechnicianName' | 'assetId'
>

export const NOTE_MAX = 2000

const entry = (
  actor: Actor,
  ts: unknown,
  note: string,
  from: TicketStatus | null = null,
  to: TicketStatus | null = null,
): HistoryDraft => ({
  fromStatus: from,
  toStatus: to,
  note: note.trim().slice(0, NOTE_MAX),
  changedBy: actor.uid,
  changedByName: actor.name,
  createdAt: ts,
})

// ---------------------------------------------------------------- create

export interface NewTicketInput {
  customerId: string
  customerName: string
  accountId: string | null
  type: TicketType
  priority: Priority
  location: string
  area: Area
  description: string
}

export function newTicket(
  input: NewTicketInput,
  actor: Actor,
  ts: unknown,
  ticketNumber = generateReference('TKT'),
) {
  const ticket = {
    ticketNumber,
    customerId: input.customerId,
    accountId: input.accountId,
    assetId: null,
    type: input.type,
    description: input.description.trim(),
    priority: input.priority,
    status: 'OPEN' as TicketStatus,
    location: input.location.trim(),
    area: input.area,
    customerName: input.customerName.trim(),
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    createdBy: actor.uid,
    createdAt: ts,
    updatedAt: ts,
    resolvedAt: null,
  }
  const note =
    actor.role === 'customer'
      ? 'Reported via the customer portal.'
      : `Logged by ${actor.name} on the customer’s behalf.`
  return { ticket, history: entry(actor, ts, note, null, 'OPEN') }
}

// ---------------------------------------------------------------- changes

export function assignTechnician(
  ticket: TicketState,
  tech: { uid: string; name: string },
  actor: Actor,
  ts: unknown,
  note = '',
): TicketChange {
  const text = ticket.assignedTechnicianId
    ? `Reassigned from ${ticket.assignedTechnicianName ?? 'another technician'} to ${tech.name}.`
    : `Assigned to ${tech.name}.`
  return {
    update: { assignedTechnicianId: tech.uid, assignedTechnicianName: tech.name, updatedAt: ts },
    history: entry(actor, ts, note.trim() ? `${text} ${note.trim()}` : text),
  }
}

/** Status change. resolvedAt is set on RESOLVED and cleared otherwise (the rules require this). */
export function changeStatus(
  ticket: TicketState,
  to: TicketStatus,
  actor: Actor,
  ts: unknown,
  note = '',
): TicketChange {
  return {
    update: { status: to, updatedAt: ts, resolvedAt: to === 'RESOLVED' ? ts : null },
    history: entry(actor, ts, note || defaultStatusNote(to), ticket.status, to),
  }
}

function defaultStatusNote(to: TicketStatus): string {
  return {
    OPEN: 'Reopened.',
    IN_PROGRESS: 'Work started.',
    ESCALATED: 'Escalated for priority attention.',
    RESOLVED: 'Resolved.',
  }[to]
}

export function changePriority(
  ticket: TicketState,
  priority: Priority,
  actor: Actor,
  ts: unknown,
): TicketChange {
  return {
    update: { priority, updatedAt: ts },
    history: entry(
      actor,
      ts,
      `Priority changed from ${label(ticket.priority)} to ${label(priority)}.`,
    ),
  }
}

/** Asset managers may link assets but not write history (see firestore.rules). */
export function linkAsset(
  asset: { id: string; name: string } | null,
  actor: Actor,
  ts: unknown,
): TicketChange {
  const writesHistory = actor.role === 'admin' || actor.role === 'call_centre'
  return {
    update: { assetId: asset?.id ?? null, updatedAt: ts },
    history: writesHistory
      ? entry(actor, ts, asset ? `Linked to asset ${asset.name}.` : 'Asset link removed.')
      : null,
  }
}

export function addNote(note: string, actor: Actor, ts: unknown): TicketChange {
  return { update: null, history: entry(actor, ts, note) }
}

const label = (p: Priority) => p[0] + p.slice(1).toLowerCase()

// ---------------------------------------------------------------- who may do what

export interface TicketPermissions {
  assign: boolean
  escalate: boolean
  resolve: boolean
  reopen: boolean
  startWork: boolean
  changePriority: boolean
  linkAsset: boolean
  addNote: boolean
}

/**
 * Which actions the ticket page offers. Never more than the security rules allow
 * (tests/rules/tickets.test.ts proves every permitted action is accepted).
 */
export function ticketPermissions(
  role: Role | null,
  ticket: TicketState,
  uid: string | undefined,
): TicketPermissions {
  const resolved = ticket.status === 'RESOLVED'
  const desk = role === 'admin' || role === 'call_centre'
  const myJob = role === 'technician' && !!uid && ticket.assignedTechnicianId === uid
  return {
    assign: desk && !resolved,
    escalate: desk && (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS'),
    resolve: !resolved && (desk || (myJob && ticket.status === 'IN_PROGRESS')),
    reopen: desk && resolved,
    startWork: myJob && (ticket.status === 'OPEN' || ticket.status === 'ESCALATED'),
    changePriority: desk && !resolved,
    linkAsset: (desk || role === 'asset_manager') && !resolved,
    addNote: desk || myJob,
  }
}

// ---------------------------------------------------------------- customer view

export interface ProgressStep {
  label: string
  state: 'done' | 'current' | 'upcoming'
}

/** Four plain-language steps shown to customers. */
export function ticketProgress(
  ticket: Pick<Ticket, 'status' | 'assignedTechnicianId'>,
): ProgressStep[] {
  const assigned = ticket.assignedTechnicianId !== null
  const working = ticket.status === 'IN_PROGRESS'
  const resolved = ticket.status === 'RESOLVED'
  const reached = [true, assigned || working || resolved, working || resolved, resolved]
  const labels = ['Reported', 'Technician assigned', 'Work in progress', 'Resolved']
  const current = resolved ? 3 : reached.lastIndexOf(true)
  return labels.map((l, i) => ({
    label: l,
    state: i === current ? 'current' : reached[i] ? 'done' : 'upcoming',
  }))
}
