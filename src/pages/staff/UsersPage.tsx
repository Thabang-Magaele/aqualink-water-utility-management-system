import { LoaderCircle, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import Button from '../../components/Button'
import { useAuth } from '../../hooks/useAuth'
import { listUsers, setUserRole } from '../../services/userService'
import { ROLE_LABELS, ROLES, type Role, type UserProfile } from '../../types/user'
import { authErrorMessage } from '../../utils/authErrors'

/**
 * Admin: view users and change roles.
 * The change goes through the setUserRole Cloud Function, which re-checks
 * that the caller is an admin. Hiding this page is not the security.
 */
export default function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<UserProfile[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, Role>>({})
  const [savingUid, setSavingUid] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((error) => setLoadError(authErrorMessage(error)))
  }, [])

  async function save(target: UserProfile) {
    const role = pending[target.uid]
    if (!role) return
    setSavingUid(target.uid)
    setMessage(null)
    try {
      await setUserRole(target.uid, role)
      setUsers((list) => list?.map((u) => (u.uid === target.uid ? { ...u, role } : u)) ?? null)
      setPending(({ [target.uid]: _, ...rest }) => rest)
      setMessage({
        tone: 'success',
        text: `${target.displayName || target.email} is now ${ROLE_LABELS[role]}.`,
      })
    } catch (error) {
      setMessage({ tone: 'error', text: (error as Error).message })
    } finally {
      setSavingUid(null)
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">Staff and roles</h1>
      <p className="text-ink/70 mt-2 max-w-prose">
        Change what each person can do in AquaLink. The change applies to their session within a few
        seconds.
      </p>

      <div className="mt-6 space-y-4">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {loadError && <Alert tone="error">{loadError}</Alert>}
      </div>

      {!users && !loadError && (
        <p className="text-ink/60 mt-8 flex items-center gap-2" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading users…
        </p>
      )}

      {users && (
        <div className="border-mist mt-6 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-mist bg-paper text-ink/70 border-b">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Email
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Role
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-mist divide-y">
              {users.map((u) => {
                const isMe = u.uid === me?.uid
                const selected = pending[u.uid] ?? u.role
                return (
                  <tr key={u.uid}>
                    <td className="px-4 py-3 font-medium">
                      {u.displayName || '—'}
                      {isMe && <span className="text-ink/60 ml-2 text-xs">(you)</span>}
                    </td>
                    <td className="text-ink/80 px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`role-${u.uid}`}>
                        Role for {u.displayName || u.email}
                      </label>
                      <select
                        id={`role-${u.uid}`}
                        value={selected}
                        disabled={isMe}
                        onChange={(e) =>
                          setPending((p) => ({ ...p, [u.uid]: e.target.value as Role }))
                        }
                        className="border-ink/20 disabled:bg-paper rounded-md border bg-white px-2 py-1.5"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pending[u.uid] && pending[u.uid] !== u.role && (
                        <Button
                          onClick={() => save(u)}
                          loading={savingUid === u.uid}
                          icon={<Save className="size-4" aria-hidden="true" />}
                          className="px-3 py-1.5 text-sm"
                        >
                          Save
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
