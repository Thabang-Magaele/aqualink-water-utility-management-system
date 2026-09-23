/** Grey placeholder shapes shown while data loads, so layouts don't jump. */

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`bg-ink/8 animate-pulse rounded ${className}`} aria-hidden="true" />
}

/** A few lines of placeholder text. */
export default function LoadingSkeleton({
  lines = 3,
  label = 'Loading…',
}: {
  lines?: number
  label?: string
}) {
  return (
    <div role="status" className="space-y-2.5">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}
