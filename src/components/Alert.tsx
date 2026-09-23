import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import type { ReactNode } from 'react'

const STYLES = {
  error: { box: 'border-fault/30 bg-fault/5 text-fault', Icon: CircleAlert },
  success: { box: 'border-clear/30 bg-clear/5 text-clear', Icon: CircleCheck },
  info: { box: 'border-channel/30 bg-channel/5 text-ink', Icon: Info },
}

export default function Alert({
  tone = 'info',
  children,
}: {
  tone?: keyof typeof STYLES
  children: ReactNode
}) {
  const { box, Icon } = STYLES[tone]
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${box}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}
