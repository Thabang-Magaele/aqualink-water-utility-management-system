/**
 * Role list for the server. Keep in sync with src/types/user.ts in the web app.
 */
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

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

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** A token with no role claim is a customer (least privilege). */
export function roleFromClaims(claims: Record<string, unknown>): Role {
  return isRole(claims.role) ? claims.role : 'customer'
}

/**
 * The ONLY place a role is ever assigned.
 * 1. Sets the custom claim (the authoritative role, enforced by rules).
 * 2. Mirrors it to users/{uid} so the UI can display it and so the signed-in
 *    user's app notices the change and refreshes its token.
 */
export async function applyRole(uid: string, role: Role): Promise<void> {
  const auth = getAuth()
  const user = await auth.getUser(uid)
  await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), role })

  const ref = getFirestore().doc(`users/${uid}`)
  const snap = await ref.get()
  if (snap.exists) {
    await ref.update({ role, updatedAt: FieldValue.serverTimestamp() })
  } else {
    await ref.set({
      uid,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      phone: user.phoneNumber ?? '',
      role,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
}
