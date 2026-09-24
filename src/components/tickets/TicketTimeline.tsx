import { ArrowRight, MessageSquareText } from 'lucide-react'
import type { TicketHistoryEntry } from '../../types/models'
import { formatDateTime } from '../../utils/format'
import StatusBadge from '../StatusBadge'

/** A ticket's history, oldest first: status changes and notes, with who and when. */
export default function TicketTimeline({ entries }: { entries: TicketHistoryEntry[] }) {
  return (
    <ol className="border-mist relative space-y-5 border-l-2 pl-6">
      {entries.map((e) => {
        const statusChange = e.toStatus !== null && e.fromStatus !== e.toStatus
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute top-1 -left-[33px] flex size-4 items-center justify-center rounded-full ring-4 ring-white ${
                statusChange ? 'bg-reservoir' : 'bg-ink/25'
              }`}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {statusChange ? (
                <span className="flex items-center gap-1.5">
                  {e.fromStatus && <StatusBadge status={e.fromStatus} />}
                  {e.fromStatus && <ArrowRight className="text-ink/40 size-3.5" aria-label="to" />}
                  <StatusBadge status={e.toStatus!} />
                </span>
              ) : (
                <MessageSquareText className="text-ink/45 size-4" aria-label="Note" />
              )}
              <span className="font-semibold">{e.changedByName}</span>
              <span className="text-ink/55">{formatDateTime(e.createdAt)}</span>
            </div>
            {e.note && <p className="text-ink/85 mt-1.5">{e.note}</p>}
          </li>
        )
      })}
    </ol>
  )
}
