import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

const STYLES = {
  error: { box: 'border-fault/30 bg-fault/5 text-fault', Icon: CircleAlert },
  warning: { box: 'border-signal/35 bg-signal/8 text-signal-ink', Icon: TriangleAlert },
  success: { box: 'border-clear/30 bg-clear/5 text-clear', Icon: CircleCheck },
  info: { box: 'border-channel/30 bg-channel/5 text-ink', Icon: Info },
}

/** An inline message that stays on the page (unlike a toast). */
export default function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof STYLES
  title?: string
  children: ReactNode
}) {
  const { box, Icon } = STYLES[tone]
  return (
    <div
      className={`flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm ${box}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  )
}
