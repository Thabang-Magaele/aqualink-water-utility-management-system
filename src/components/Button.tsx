import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  loading?: boolean
  icon?: ReactNode
}

const VARIANTS = {
  primary: 'bg-reservoir text-white hover:bg-reservoir-deep',
  secondary: 'border border-ink/20 bg-white text-ink hover:bg-mist',
}

export default function Button({
  variant = 'primary',
  loading = false,
  icon,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}
