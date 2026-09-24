/**
 * Decides who is notified when a ticket changes. Pure: no Firebase imports,
 * unit-tested in ticketEvents.test.ts. The trigger in triggers/onTicketWritten.ts
 * turns these drafts into notification documents.
 */

export interface TicketSnapshot {
  ticketNumber: string
  customerId: string
  type: string
  area: string
  location: string
  status: string
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  createdBy: string
}

export interface NotificationDraft {
  userId: string
  title: string
  message: string
  type: 'TICKET'
  relatedId: string
  link: string
}

// Keep in sync with TICKET_TYPE_LABELS in src/types/models.ts
const TYPE_LABELS: Record<string, string> = {
  LEAK: 'leak',
  BURST_PIPE: 'burst pipe',
  NO_WATER: 'no-water',
  LOW_PRESSURE: 'low-pressure',
  WATER_QUALITY: 'water-quality',
  METER_FAULT: 'meter-fault',
  OTHER: 'problem',
}
const typeLabel = (t: string) => TYPE_LABELS[t] ?? 'problem'
const capitalise = (s: string) => s[0].toUpperCase() + s.slice(1)

/**
 * @param deskStaff uids of call-centre and admin users, told about new reports.
 *                  Only needed when the ticket was just created.
 */
export function planTicketNotifications(
  ticketId: string,
  before: TicketSnapshot | null,
  after: TicketSnapshot | null,
  deskStaff: string[] = [],
): NotificationDraft[] {
  if (!after) return [] // deleted
  const drafts: NotificationDraft[] = []
  const toCustomer = (title: string, message: string) =>
    drafts.push({
      userId: after.customerId,
      title,
      message,
      type: 'TICKET',
      relatedId: ticketId,
      link: `/customer/tickets/${ticketId}`,
    })
  const t = after

  // New report
  if (!before) {
    toCustomer(
      'Report received',
      `We've logged your ${typeLabel(t.type)} report ${t.ticketNumber} at ${t.location}. We'll let you know when a technician is assigned.`,
    )
    for (const uid of new Set(deskStaff)) {
      if (uid === t.createdBy) continue // don't notify the agent who logged it
      drafts.push({
        userId: uid,
        title: `New ${typeLabel(t.type)} report`,
        message: `${t.ticketNumber} in ${t.area}: ${t.location}`,
        type: 'TICKET',
        relatedId: ticketId,
        link: `/staff/tickets/${ticketId}`,
      })
    }
    return drafts
  }

  // (Re)assigned to a technician
  if (t.assignedTechnicianId && t.assignedTechnicianId !== before.assignedTechnicianId) {
    drafts.push({
      userId: t.assignedTechnicianId,
      title: 'New job assigned',
      message: `${t.ticketNumber}: ${capitalise(typeLabel(t.type))} at ${t.location}`,
      type: 'TICKET',
      relatedId: ticketId,
      link: `/staff/field/${ticketId}`,
    })
    toCustomer(
      'Technician assigned',
      `${t.assignedTechnicianName ?? 'A technician'} has been assigned to your report ${t.ticketNumber}.`,
    )
  }

  // Status changes the customer cares about
  if (t.status !== before.status) {
    const messages: Record<string, [string, string] | undefined> = {
      IN_PROGRESS: [
        'Work has started',
        `A technician is working on ${t.ticketNumber} at ${t.location}.`,
      ],
      ESCALATED: [
        'Report escalated',
        `${t.ticketNumber} has been escalated for priority attention.`,
      ],
      RESOLVED: [
        'Issue resolved',
        `${t.ticketNumber} has been resolved. Thank you for reporting it.`,
      ],
      OPEN:
        before.status === 'RESOLVED'
          ? ['Report reopened', `${t.ticketNumber} has been reopened and will be looked at again.`]
          : undefined,
    }
    const message = messages[t.status]
    if (message) toCustomer(...message)
  }
  return drafts
}
