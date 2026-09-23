import { LoaderCircle } from 'lucide-react'

/** Inline loading indicator. Pair with visible text or pass a `label` for screen readers. */
export default function Spinner({
  className = 'size-5',
  label,
}: {
  className?: string
  label?: string
}) {
  return (
    <>
      <LoaderCircle className={`animate-spin ${className}`} aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </>
  )
}
