/** Test fixtures for the notification screens (fictional). */
import type { Notification } from '../../types/models'

const at = (minutesAgo: number) => {
  const d = new Date(Date.now() - minutesAgo * 60_000)
  return { toDate: () => d, toMillis: () => +d } as unknown as Notification['createdAt']
}

export const notifications: Notification[] = [
  {
    id: 'n1',
    userId: 'c1',
    type: 'TICKET',
    title: 'Ticket resolved',
    message: 'TKT-260925-R5W2: Replaced a cracked coupling. Pressure restored.',
    relatedId: 't1',
    link: '/customer/tickets/t1',
    read: false,
    createdAt: at(5),
  },
  {
    id: 'n2',
    userId: 'c1',
    type: 'OUTAGE',
    title: 'Water outage: Hilltop Reservoir cleaning',
    message: 'Affecting KaNyamazane, Tekwane. Expected back by Thu 1 Oct, 18:00.',
    relatedId: 'o1',
    link: '/customer',
    read: false,
    createdAt: at(90),
  },
  {
    id: 'n3',
    userId: 'c1',
    type: 'PAYMENT',
    title: 'Payment received',
    message: 'Thank you. R 433,20 for INV-202609-4100223107 was received.',
    relatedId: 'i1',
    link: '/customer/bills/i1',
    read: true,
    createdAt: at(60 * 26),
  },
  {
    id: 'n4',
    userId: 'c1',
    type: 'SYSTEM',
    title: 'Welcome to AquaLink',
    message: 'You can now pay bills and report problems online.',
    relatedId: null,
    link: null,
    read: true,
    createdAt: at(60 * 24 * 9),
  },
]
