import type { Timestamp } from 'firebase/firestore'

/**
 * Every role in AquaLink. The authoritative value lives in the user's
 * Firebase Custom Claims (set server-side in Phase 2), never in client state.
 */
export const ROLES = [
  'admin',
  'call_centre',
  'technician',
  'billing',
  'asset_manager',
  'water_quality',
  'communications',
  'customer',
] as const

export type Role = (typeof ROLES)[number]

export const STAFF_ROLES = ROLES.filter((r) => r !== 'customer') as Exclude<Role, 'customer'>[]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  call_centre: 'Call centre',
  technician: 'Technician',
  billing: 'Billing',
  asset_manager: 'Asset manager',
  water_quality: 'Water quality',
  communications: 'Communications',
  customer: 'Customer',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** Stored at users/{uid}. `role` mirrors the custom claim for display only. */
export interface UserProfile {
  uid: string
  displayName: string
  email: string
  phone: string
  role: Role
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * Authentication lifecycle.
 * "Unauthorized" (signed in but wrong role) is decided per route by ProtectedRoute.
 */
export type AuthStatus = 'authenticating' | 'unauthenticated' | 'authenticated'
