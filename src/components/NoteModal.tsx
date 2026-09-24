import { useState, type FormEvent } from 'react'
import Alert from './Alert'
import Button from './Button'
import { FormTextarea } from './FormField'
import Modal from './Modal'

interface NoteModalProps {
  open: boolean
  title: string
  description?: string
  label: string
  confirmLabel: string
  /** Minimum characters; 0 makes the note optional. */
  minLength?: number
  tone?: 'primary' | 'danger'
  onSubmit: (note: string) => Promise<void>
  onClose: () => void
}

/** Asks for a note before an action (resolve, add note, escalate…). Stays open if saving fails. */
export default function NoteModal(props: NoteModalProps) {
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      description={props.description}
    >
      {props.open && <NoteForm {...props} />}
    </Modal>
  )
}

function NoteForm({
  label,
  confirmLabel,
  minLength = 0,
  tone = 'primary',
  onSubmit,
  onClose,
}: NoteModalProps) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (note.trim().length < minLength) {
      setError(minLength > 1 ? `Write at least ${minLength} characters.` : 'Write a note.')
      return
    }
    setSaving(true)
    setFailure(null)
    try {
      await onSubmit(note.trim())
      onClose()
    } catch (err) {
      setFailure(err instanceof Error && err.message ? err.message : 'Saving failed. Try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {failure && <Alert tone="error">{failure}</Alert>}
      <FormTextarea
        label={label}
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          setError(null)
        }}
        error={error}
        maxLength={2000}
        required={minLength > 0}
        rows={4}
      />
      <div className="border-mist flex justify-end gap-2 border-t pt-4">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant={tone} loading={saving}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  )
}
