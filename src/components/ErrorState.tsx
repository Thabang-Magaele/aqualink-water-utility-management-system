import { CircleAlert, RotateCw } from 'lucide-react'
import Button from './Button'

interface ErrorStateProps {
  title?: string
  /** A friendly message. Never a raw error or stack trace. */
  message: string
  onRetry?: () => void
}

/** Shown in place of content that failed to load. */
export default function ErrorState({
  title = "This couldn't load",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center" role="alert">
      <span className="bg-fault/8 text-fault rounded-full p-3">
        <CircleAlert className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="text-ink/65 mt-1 max-w-sm text-sm">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={onRetry}
          icon={<RotateCw className="size-4" aria-hidden="true" />}
        >
          Try again
        </Button>
      )}
    </div>
  )
}
