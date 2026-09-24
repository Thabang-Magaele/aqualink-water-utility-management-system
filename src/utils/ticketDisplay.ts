import type { Priority, Ticket, TicketType } from '../types/models'
import { TICKET_TYPE_LABELS } from '../types/models'

export const typeLabel = (type: TicketType) => TICKET_TYPE_LABELS[type] ?? type

/** Higher = more urgent; for sorting. */
export const PRIORITY_RANK: Record<Priority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }

/** How customers describe seriousness, mapped to a starting priority. Critical is set by staff. */
export const SERIOUSNESS: { priority: Priority; label: string; hint: string }[] = [
  { priority: 'LOW', label: 'Minor', hint: 'A slow drip or damp patch' },
  { priority: 'MEDIUM', label: 'Moderate', hint: 'Steady leak, or low pressure' },
  { priority: 'HIGH', label: 'Serious', hint: 'Water running freely, or no water at all' },
]

/** Search a ticket by number, customer, location, area or technician. */
export function matchesTicket(t: Ticket, term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return [
    t.ticketNumber,
    t.customerName,
    t.location,
    t.area,
    t.assignedTechnicianName ?? '',
    typeLabel(t.type),
  ].some((field) => field.toLowerCase().includes(needle))
}

/** "14 Mahlangu Street, KaNyamazane", without repeating the area if the address already names it. */
export function placeLabel(t: Pick<Ticket, 'location' | 'area'>): string {
  return t.location.toLowerCase().includes(t.area.toLowerCase())
    ? t.location
    : `${t.location}, ${t.area}`
}
