import type { ReactNode } from 'react'
import Button from './Button'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  /** Verb for the confirm button, e.g. "Change role", "Delete asset". Avoid "OK". */
  confirmLabel: string
  cancelLabel?: string
  /** "danger" for destructive or sensitive actions. */
  tone?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-ink/80">{message}</div>
    </Modal>
  )
}
