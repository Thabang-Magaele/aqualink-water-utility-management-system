import { useId, type InputHTMLAttributes } from 'react'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
  hint?: string
}

/** Labelled input with hint and error text wired up for screen readers. */
export default function FormInput({
  label,
  error,
  hint,
  id,
  className = '',
  ...rest
}: FormInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-ink/60 mt-0.5 text-sm">
          {hint}
        </p>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={`mt-1.5 block w-full rounded-md border bg-white px-3 py-2.5 text-base shadow-xs focus:ring-2 focus:outline-none ${
          error
            ? 'border-fault focus:border-fault focus:ring-fault/20'
            : 'border-ink/20 focus:border-channel focus:ring-channel/25'
        }`}
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-fault mt-1.5 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
