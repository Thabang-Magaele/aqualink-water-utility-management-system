import { Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import ConfirmDialog from '../../components/ConfirmDialog'
import DataTable, { type Column } from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import SearchBar from '../../components/SearchBar'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { listUsers, setUserRole } from '../../services/userService'
import { ROLE_LABELS, ROLES, type Role, type UserProfile } from '../../types/user'
import { authErrorMessage } from '../../utils/authErrors'
import { controlClass } from '../../components/formStyles'

/**
 * Admin: view users and change roles.
 * The change goes through the setUserRole Cloud Function, which re-checks
 * that the caller is an admin. Hiding this page is not the security.
 */
export default function UsersPage() {
  const { user: me } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<UserProfile[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [pending, setPending] = useState<Record<string, Role>>({})
  const [confirming, setConfirming] = useState<{ user: UserProfile; role: Role } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoadError(null)
    setUsers(null)
    listUsers()
      .then(setUsers)
      .catch((error) => setLoadError(authErrorMessage(error)))
  }, [])

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((error) => setLoadError(authErrorMessage(error)))
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (users ?? []).filter(
      (u) =>
        (roleFilter === 'all' || u.role === roleFilter) &&
        (!term ||
          u.displayName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term)),
    )
  }, [users, search, roleFilter])

  async function confirmChange() {
    if (!confirming) return
    const { user: target, role } = confirming
    setSaving(true)
    try {
      await setUserRole(target.uid, role)
      setUsers((list) => list?.map((u) => (u.uid === target.uid ? { ...u, role } : u)) ?? null)
      setPending(({ [target.uid]: _, ...rest }) => rest)
      toast({
        title: 'Role updated',
        message: `${target.displayName || target.email} is now ${ROLE_LABELS[role]}.`,
      })
    } catch (error) {
      toast({ tone: 'error', title: "Role wasn't changed", message: (error as Error).message })
    } finally {
      setSaving(false)
      setConfirming(null)
    }
  }

  const columns: Column<UserProfile>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: (u) => u.displayName,
      render: (u) => (
        <span className="font-medium">
          {u.displayName || '—'}
          {u.uid === me?.uid && <span className="text-ink/60 ml-2 text-xs font-normal">(you)</span>}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortValue: (u) => u.email,
      render: (u) => <span className="text-ink/80">{u.email}</span>,
    },
    {
      key: 'current',
      header: 'Current role',
      sortValue: (u) => ROLE_LABELS[u.role],
      render: (u) => (
        <StatusBadge
          status={u.role}
          label={ROLE_LABELS[u.role]}
          tone={u.role === 'admin' ? 'warning' : u.role === 'customer' ? 'neutral' : 'info'}
        />
      ),
    },
    {
      key: 'change',
      header: 'Change role',
      render: (u) => (
        <>
          <label className="sr-only" htmlFor={`role-${u.uid}`}>
            New role for {u.displayName || u.email}
          </label>
          <select
            id={`role-${u.uid}`}
            value={pending[u.uid] ?? u.role}
            disabled={u.uid === me?.uid}
            onChange={(e) => setPending((p) => ({ ...p, [u.uid]: e.target.value as Role }))}
            className={`${controlClass(false)} max-w-48 py-1.5 text-sm`}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      align: 'right',
      render: (u) =>
        pending[u.uid] && pending[u.uid] !== u.role ? (
          <Button
            size="sm"
            onClick={() => setConfirming({ user: u, role: pending[u.uid] })}
            icon={<Save className="size-4" aria-hidden="true" />}
          >
            Save
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Staff and roles"
        description="Change what each person can do in AquaLink. The change applies to their session within a few seconds."
      />

      <Card padded={false}>
        <div className="border-mist flex flex-col gap-3 border-b p-4 sm:flex-row">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email"
            className="flex-1"
          />
          <label className="sr-only" htmlFor="role-filter">
            Filter by role
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
            className={`${controlClass(false)} sm:w-52`}
          >
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <DataTable
          caption="Users and their roles"
          columns={columns}
          rows={filtered}
          pageSize={10}
          getRowId={(u) => u.uid}
          loading={!users && !loadError}
          error={loadError}
          onRetry={load}
          initialSort={{ key: 'name', direction: 'asc' }}
          emptyTitle={search || roleFilter !== 'all' ? 'No matching users' : 'No users yet'}
          emptyDescription={
            search || roleFilter !== 'all'
              ? 'Try a different name, email or role.'
              : 'People appear here after they register or are created with the set-role script.'
          }
        />
      </Card>

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Change role?"
        tone={confirming?.role === 'admin' ? 'danger' : 'primary'}
        confirmLabel="Change role"
        loading={saving}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmChange}
        message={
          confirming && (
            <>
              <strong>{confirming.user.displayName || confirming.user.email}</strong> will change
              from {ROLE_LABELS[confirming.user.role]} to{' '}
              <strong>{ROLE_LABELS[confirming.role]}</strong>.
              {confirming.role === 'admin' &&
                ' Administrators can see all data and change anyone’s role.'}
            </>
          )
        }
      />
    </>
  )
}
