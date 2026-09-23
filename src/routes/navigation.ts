/**
 * Single source of truth for navigation AND route access.
 * The menu shows only items whose `roles` include the user's role, and
 * AppRoutes wraps each path in ProtectedRoute with the same `roles`.
 * (Firestore rules and Cloud Functions are still the real enforcement.)
 */
import {
  Bell,
  ChartColumn,
  CircleUser,
  CreditCard,
  Factory,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Megaphone,
  Receipt,
  ScrollText,
  Ticket,
  TriangleAlert,
  UserCog,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { STAFF_ROLES, type Role } from '../types/user'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  roles: readonly Role[]
  /** Phase in which the real page is built (shown on placeholders). */
  phase: number
}

export const STAFF_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/staff', icon: LayoutDashboard, roles: STAFF_ROLES, phase: 6 },
  {
    label: 'Customers',
    path: '/staff/customers',
    icon: Users,
    roles: ['admin', 'call_centre', 'billing'],
    phase: 7,
  },
  {
    label: 'Accounts',
    path: '/staff/accounts',
    icon: Wallet,
    roles: ['admin', 'call_centre', 'billing'],
    phase: 7,
  },
  {
    label: 'Billing',
    path: '/staff/billing',
    icon: Receipt,
    roles: ['admin', 'billing'],
    phase: 10,
  },
  { label: 'Meters', path: '/staff/meters', icon: Gauge, roles: ['admin', 'billing'], phase: 9 },
  {
    label: 'Field Operations',
    path: '/staff/field',
    icon: Wrench,
    roles: ['admin', 'technician'],
    phase: 8,
  },
  {
    label: 'Tickets',
    path: '/staff/tickets',
    icon: Ticket,
    roles: ['admin', 'call_centre', 'asset_manager'],
    phase: 8,
  },
  {
    label: 'Assets',
    path: '/staff/assets',
    icon: Factory,
    roles: ['admin', 'asset_manager'],
    phase: 15,
  },
  {
    label: 'Water Quality',
    path: '/staff/water-quality',
    icon: FlaskConical,
    roles: ['admin', 'water_quality'],
    phase: 14,
  },
  {
    label: 'Communications',
    path: '/staff/communications',
    icon: Megaphone,
    roles: ['admin', 'communications'],
    phase: 16,
  },
  { label: 'Staff', path: '/staff/users', icon: UserCog, roles: ['admin'], phase: 2 },
  { label: 'Audit Logs', path: '/staff/audit-logs', icon: ScrollText, roles: ['admin'], phase: 18 },
]

export const CUSTOMER_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/customer', icon: LayoutDashboard, roles: ['customer'], phase: 17 },
  { label: 'My Account', path: '/customer/account', icon: Wallet, roles: ['customer'], phase: 17 },
  { label: 'Bills', path: '/customer/bills', icon: CreditCard, roles: ['customer'], phase: 10 },
  { label: 'Usage', path: '/customer/usage', icon: ChartColumn, roles: ['customer'], phase: 9 },
  {
    label: 'Report Issue',
    path: '/customer/report',
    icon: TriangleAlert,
    roles: ['customer'],
    phase: 8,
  },
  { label: 'My Tickets', path: '/customer/tickets', icon: Ticket, roles: ['customer'], phase: 8 },
  {
    label: 'Notifications',
    path: '/customer/notifications',
    icon: Bell,
    roles: ['customer'],
    phase: 12,
  },
  { label: 'Profile', path: '/customer/profile', icon: CircleUser, roles: ['customer'], phase: 17 },
]

export function navFor(role: Role | null): NavItem[] {
  if (!role) return []
  const items = role === 'customer' ? CUSTOMER_NAV : STAFF_NAV
  return items.filter((item) => item.roles.includes(role))
}

export function homePathFor(role: Role | null): string {
  return role === 'customer' ? '/customer' : '/staff'
}

/** True if `path` is a menu page this role may open. */
export function canOpen(role: Role | null, path: string): boolean {
  if (!role) return false
  const item = [...STAFF_NAV, ...CUSTOMER_NAV].find((i) => i.path === path)
  return Boolean(item?.roles.includes(role))
}
