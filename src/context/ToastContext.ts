import { createContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastInput {
  tone?: ToastTone
  title: string
  message?: string
}

export interface ToastContextValue {
  /** Show a short-lived message, e.g. after saving. For lasting messages use <Alert>. */
  toast: (input: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
