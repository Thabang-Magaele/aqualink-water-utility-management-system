import { CircleCheck, CircleAlert, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { checkFirebaseConnection, type ConnectionStatus as Status } from '../services/firebase'

/**
 * Development-only indicator showing whether the app can reach Firebase.
 * Rendered only when import.meta.env.DEV is true.
 */
export default function ConnectionStatus() {
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    let active = true
    checkFirebaseConnection().then((result) => {
      if (active) setStatus(result)
    })
    return () => {
      active = false
    }
  }, [])

  if (!status) {
    return (
      <p className="text-ink/60 flex items-center gap-2 text-sm" role="status">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Checking Firebase connection…
      </p>
    )
  }

  const ok = status.state === 'connected'
  const Icon = ok ? CircleCheck : CircleAlert
  return (
    <p
      className={`flex items-start gap-2 text-sm ${ok ? 'text-clear' : 'text-fault'}`}
      role="status"
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">{ok ? 'Connected' : 'Not connected'}</span> to{' '}
        <code className="bg-mist text-ink rounded px-1">{status.projectId}</code>. {status.detail}
      </span>
    </p>
  )
}
