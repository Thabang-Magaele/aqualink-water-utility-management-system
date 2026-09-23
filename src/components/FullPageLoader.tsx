import { LoaderCircle } from 'lucide-react'

export default function FullPageLoader({ label = 'Loading AquaLink…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <LoaderCircle className="text-reservoir size-8 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
