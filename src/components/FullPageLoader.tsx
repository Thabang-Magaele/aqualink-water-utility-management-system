import Spinner from './Spinner'

export default function FullPageLoader({ label = 'Loading AquaLink…' }: { label?: string }) {
  return (
    <div
      className="text-reservoir flex min-h-dvh items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-8" label={label} />
    </div>
  )
}
