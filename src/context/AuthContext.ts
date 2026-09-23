import type { User } from 'firebase/auth'
import { createContext } from 'react'
import type { RegistrationInput } from '../services/authService'
import type { AuthStatus, Role, UserProfile } from '../types/user'

export interface AuthContextValue {
  status: AuthStatus
  /** Firebase Auth user, null when signed out. */
  user: User | null
  /** From custom claims. Null while signed out. */
  role: Role | null
  /** users/{uid} document; null if not created yet. */
  profile: UserProfile | null
  profileLoading: boolean
  /** True while a registration is in progress (keeps the form mounted). */
  registering: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  register: (input: RegistrationInput) => Promise<void>
  /** Forces a token refresh so new custom claims apply without signing out. */
  refreshClaims: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
