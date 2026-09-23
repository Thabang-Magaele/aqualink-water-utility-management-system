import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { controlClass } from './formStyles'

/** Props passed to the control inside a FormField, wiring label, hint and error for screen readers. */
export interface FieldControlProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby'?: string
  required?: boolean
}

interface FormFieldProps {
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  className?: string
  id?: string
  /** Render the control, spreading the props given: {(p) => <input {...p} />} */
  children: (props: FieldControlProps) => ReactNode
}

/** Label + hint + error wrapper for any form control. */
export function FormField({
  label,
  hint,
  error,
  required,
  className = '',
  id,
  children,
}: FormFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="block text-sm font-semibold">
        {label}
        {required && (
          <span className="text-fault" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-ink/60 mt-0.5 text-sm">
          {hint}
        </p>
      )}
      <div className="mt-1.5">
        {children({
          id: fieldId,
          'aria-invalid': Boolean(error),
          'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
          required,
        })}
      </div>
      {error && (
        <p id={errorId} className="text-fault mt-1.5 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

type Base = { label: string; hint?: string; error?: string | null; className?: string }

export function FormInput({
  label,
  hint,
  error,
  className,
  id,
  required,
  ...rest
}: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      className={className}
      id={id}
      required={required}
    >
      {(p) => <input {...p} {...rest} className={controlClass(Boolean(error))} />}
    </FormField>
  )
}

export function FormSelect({
  label,
  hint,
  error,
  className,
  id,
  required,
  children,
  ...rest
}: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      className={className}
      id={id}
      required={required}
    >
      {(p) => (
        <select {...p} {...rest} className={controlClass(Boolean(error))}>
          {children}
        </select>
      )}
    </FormField>
  )
}

export function FormTextarea({
  label,
  hint,
  error,
  className,
  id,
  required,
  rows = 4,
  ...rest
}: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      className={className}
      id={id}
      required={required}
    >
      {(p) => <textarea {...p} rows={rows} {...rest} className={controlClass(Boolean(error))} />}
    </FormField>
  )
}
