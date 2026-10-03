import {
  Bell,
  CreditCard,
  FlaskConical,
  Info,
  Receipt,
  Ticket,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import type { NotificationType } from '../types/models'
import type { Role } from '../types/user'

/** Label, icon and "open" wording for each kind of notification. */
export const NOTIFICATION_KINDS: Record<
  NotificationType,
  { label: string; icon: LucideIcon; open: string }
> = {
  TICKET: { label: 'Ticket', icon: Ticket, open: 'Open the ticket' },
  BILLING: { label: 'Bill', icon: Receipt, open: 'Open the invoice' },
  PAYMENT: { label: 'Payment', icon: CreditCard, open: 'Open the invoice' },
  OUTAGE: { label: 'Outage', icon: TriangleAlert, open: 'Go to my dashboard' },
  WATER_QUALITY: { label: 'Water quality', icon: FlaskConical, open: 'Open water quality' },
  SYSTEM: { label: 'AquaLink', icon: Info, open: 'Open' },
}

export const kindOf = (type: string) =>
  NOTIFICATION_KINDS[type as NotificationType] ?? {
    label: 'Notification',
    icon: Bell,
    open: 'Open',
  }

/** Where a role's notifications live. */
export function notificationsPath(role: Role | null): string {
  return role === 'customer' ? '/customer/notifications' : '/staff/notifications'
}
