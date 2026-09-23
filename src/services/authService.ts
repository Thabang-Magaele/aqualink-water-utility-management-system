/**
 * All Firebase Authentication calls live here so pages and context stay thin.
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore'
import { isRole, type Role, type UserProfile } from '../types/user'
import { normalisePhone } from '../utils/validation'
import { auth, db } from './firebase'

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export interface RegistrationInput {
  displayName: string
  email: string
  phone: string
  password: string
}

/**
 * Self-registration is for customers only. Staff accounts are created by an
 * admin (Phase 2). The rules only allow a new profile with role "customer".
 */
export async function registerCustomer(input: RegistrationInput): Promise<void> {
  const credential = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password)
  const displayName = input.displayName.trim()
  await updateProfile(credential.user, { displayName })
  await setDoc(doc(db, 'users', credential.user.uid), {
    uid: credential.user.uid,
    displayName,
    email: credential.user.email,
    phone: normalisePhone(input.phone),
    role: 'customer',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Reads the role from the ID token's custom claims.
 * No claim yet means the least-privileged role: customer.
 */
export async function getRoleFromToken(user: User): Promise<Role> {
  const { claims } = await user.getIdTokenResult()
  return isRole(claims.role) ? claims.role : 'customer'
}

/** Live subscription to users/{uid}. Calls back with null if the doc doesn't exist. */
export function subscribeToProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onChange(snap.exists() ? (snap.data() as UserProfile) : null),
    onError,
  )
}
