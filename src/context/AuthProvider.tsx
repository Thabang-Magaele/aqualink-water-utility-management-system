import { onIdTokenChanged, type User } from 'firebase/auth'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authService from '../services/authService'
import { auth } from '../services/firebase'
import type { AuthStatus, Role, UserProfile } from '../types/user'
import { AuthContext, type AuthContextValue } from './AuthContext'

interface SessionState {
  status: AuthStatus
  user: User | null
  role: Role | null
}

interface ProfileState {
  uid: string
  profile: UserProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    status: 'authenticating',
    user: null,
    role: null,
  })
  const [profileState, setProfileState] = useState<ProfileState | null>(null)
  const [registering, setRegistering] = useState(false)

  // Firebase restores the session from browser storage on refresh, then calls this.
  // onIdTokenChanged (not onAuthStateChanged) also fires when claims are refreshed.
  useEffect(() => {
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setSession({ status: 'unauthenticated', user: null, role: null })
        return
      }
      let role: Role = 'customer'
      try {
        role = await authService.getRoleFromToken(user)
      } catch {
        // Fall back to least privilege; Firestore rules still decide real access.
      }
      // Ignore a stale result if the user changed while we were waiting.
      if (auth.currentUser?.uid === user.uid) {
        setSession({ status: 'authenticated', user, role })
      }
    })
  }, [])

  const uid = session.user?.uid
  useEffect(() => {
    if (!uid) return
    return authService.subscribeToProfile(
      uid,
      (profile) => setProfileState({ uid, profile }),
      () => setProfileState({ uid, profile: null }),
    )
  }, [uid])

  // Only trust profile data that belongs to the current user.
  const profile = profileState && profileState.uid === uid ? profileState.profile : null
  const profileLoading = Boolean(uid) && profileState?.uid !== uid

  // When an admin changes this user's role, the server updates users/{uid}.role.
  // Seeing that change, refresh the ID token so the new claim applies immediately.
  const profileRole = profile?.role
  useEffect(() => {
    if (profileRole && session.role && profileRole !== session.role) {
      auth.currentUser?.getIdToken(true).catch(() => {})
    }
  }, [profileRole, session.role])

  const register = useCallback(async (input: authService.RegistrationInput) => {
    setRegistering(true)
    try {
      await authService.registerCustomer(input)
    } finally {
      setRegistering(false)
    }
  }, [])

  const refreshClaims = useCallback(async () => {
    await auth.currentUser?.getIdToken(true)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      profile,
      profileLoading,
      registering,
      signIn: authService.signIn,
      signOut: authService.signOut,
      register,
      refreshClaims,
    }),
    [session, profile, profileLoading, registering, register, refreshClaims],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
