import { CircleCheck, MessageSquarePlus, Play, RotateCcw, Siren } from 'lucide-react'
import { useState } from 'react'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import { controlClass } from '../../../components/formStyles'
import NoteModal from '../../../components/NoteModal'
import { useAsync } from '../../../hooks/useAsync'
import { useToast } from '../../../hooks/useToast'
import {
  addNote,
  assignTechnician,
  changePriority,
  changeStatus,
  linkAsset,
  type Actor,
  type TicketChange,
  type TicketPermissions,
} from '../../../services/ticketActions'
import { applyTicketChange, loadAssets, loadTechnicians } from '../../../services/ticketService'
import { serverTimestamp } from 'firebase/firestore'
import { PRIORITIES, type Priority, type Ticket } from '../../../types/models'
import { friendlyError } from '../../../utils/errors'

type Dialog = 'resolve' | 'escalate' | 'reopen' | 'note' | null

/** The actions this user may take on this ticket (from ticketPermissions). */
export default function TicketActionsCard({
  ticket,
  actor,
  can,
}: {
  ticket: Ticket
  actor: Actor
  can: TicketPermissions
}) {
  const { toast } = useToast()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const technicians = useAsync(can.assign ? loadTechnicians : null, 'technicians')
  const assets = useAsync(can.linkAsset ? loadAssets : null, 'assets')
  const [techId, setTechId] = useState('')
  const [priority, setPriority] = useState<Priority>(ticket.priority)
  const [assetId, setAssetId] = useState(ticket.assetId ?? '')
  const now = () => serverTimestamp()

  /** For buttons: report the outcome with a toast. */
  async function run(name: string, change: TicketChange, success: string) {
    setBusy(name)
    try {
      await applyTicketChange(ticket.id, change)
      toast({ title: success })
    } catch (err) {
      toast({ tone: 'error', title: 'That didn’t save', message: friendlyError(err) })
    } finally {
      setBusy(null)
    }
  }
  /** For dialogs: errors are shown inside the dialog, which stays open. */
  async function save(change: TicketChange, success: string) {
    try {
      await applyTicketChange(ticket.id, change)
    } catch (err) {
      throw new Error(friendlyError(err), { cause: err })
    }
    toast({ title: success })
  }

  const anything = Object.values(can).some(Boolean)
  if (!anything) return null
  const tech = technicians.data?.find((t) => t.uid === techId)

  return (
    <Card title="Actions">
      <div className="space-y-5">
        {/* Technician: big, simple buttons for use on a phone */}
        {can.startWork && (
          <Button
            className="w-full py-3"
            loading={busy === 'start'}
            onClick={() =>
              run('start', changeStatus(ticket, 'IN_PROGRESS', actor, now()), 'Work started')
            }
            icon={<Play className="size-4" aria-hidden="true" />}
          >
            Start work
          </Button>
        )}

        {can.assign && (
          <div>
            <label htmlFor="assign-tech" className="block text-sm font-semibold">
              {ticket.assignedTechnicianId ? 'Reassign to' : 'Assign a technician'}
            </label>
            <div className="mt-1.5 flex gap-2">
              <select
                id="assign-tech"
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
                disabled={technicians.loading}
                className={controlClass(false)}
              >
                <option value="">{technicians.loading ? 'Loading…' : 'Choose…'}</option>
                {technicians.data
                  ?.filter((t) => t.uid !== ticket.assignedTechnicianId)
                  .map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.name}
                    </option>
                  ))}
              </select>
              <Button
                disabled={!tech}
                loading={busy === 'assign'}
                onClick={() =>
                  tech &&
                  run(
                    'assign',
                    assignTechnician(ticket, tech, actor, now()),
                    `Assigned to ${tech.name}`,
                  ).then(() => setTechId(''))
                }
              >
                Assign
              </Button>
            </div>
            {technicians.error ? (
              <p className="text-fault mt-1 text-sm">{friendlyError(technicians.error)}</p>
            ) : null}
            {technicians.data?.length === 0 && (
              <p className="text-ink/60 mt-1 text-sm">No technician accounts exist yet.</p>
            )}
          </div>
        )}

        {can.changePriority && (
          <div>
            <label htmlFor="ticket-priority-set" className="block text-sm font-semibold">
              Priority
            </label>
            <div className="mt-1.5 flex gap-2">
              <select
                id="ticket-priority-set"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className={controlClass(false)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0] + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                disabled={priority === ticket.priority}
                loading={busy === 'priority'}
                onClick={() =>
                  run(
                    'priority',
                    changePriority(ticket, priority, actor, now()),
                    'Priority updated',
                  )
                }
              >
                Update
              </Button>
            </div>
          </div>
        )}

        {can.linkAsset && (
          <div>
            <label htmlFor="ticket-asset" className="block text-sm font-semibold">
              Related asset
            </label>
            <div className="mt-1.5 flex gap-2">
              <select
                id="ticket-asset"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                disabled={assets.loading}
                className={controlClass(false)}
              >
                <option value="">None</option>
                {assets.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code}: {a.name}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                disabled={assetId === (ticket.assetId ?? '')}
                loading={busy === 'asset'}
                onClick={() => {
                  const asset = assets.data?.find((a) => a.id === assetId)
                  run(
                    'asset',
                    linkAsset(asset ? { id: asset.id, name: asset.name } : null, actor, now()),
                    'Asset link saved',
                  )
                }}
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {(can.resolve || can.escalate || can.reopen || can.addNote) && (
          <div
            className={`flex flex-col gap-2 ${can.startWork || can.assign || can.changePriority || can.linkAsset ? 'border-mist border-t pt-5' : ''}`}
          >
            {can.resolve && (
              <Button
                variant={can.startWork ? 'secondary' : 'primary'}
                className="w-full"
                onClick={() => setDialog('resolve')}
                icon={<CircleCheck className="size-4" aria-hidden="true" />}
              >
                Mark as resolved
              </Button>
            )}
            {can.escalate && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setDialog('escalate')}
                icon={<Siren className="size-4" aria-hidden="true" />}
              >
                Escalate
              </Button>
            )}
            {can.reopen && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setDialog('reopen')}
                icon={<RotateCcw className="size-4" aria-hidden="true" />}
              >
                Reopen
              </Button>
            )}
            {can.addNote && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setDialog('note')}
                icon={<MessageSquarePlus className="size-4" aria-hidden="true" />}
              >
                Add a note
              </Button>
            )}
          </div>
        )}
      </div>

      <NoteModal
        open={dialog === 'resolve'}
        title="Mark as resolved"
        description="The customer is notified and sees your summary."
        label="What was done?"
        confirmLabel="Mark as resolved"
        minLength={10}
        onClose={() => setDialog(null)}
        onSubmit={(note) =>
          save(changeStatus(ticket, 'RESOLVED', actor, now(), note), 'Ticket resolved')
        }
      />
      <NoteModal
        open={dialog === 'escalate'}
        title="Escalate this ticket"
        label="Reason (optional)"
        confirmLabel="Escalate"
        tone="danger"
        onClose={() => setDialog(null)}
        onSubmit={(note) =>
          save(changeStatus(ticket, 'ESCALATED', actor, now(), note), 'Ticket escalated')
        }
      />
      <NoteModal
        open={dialog === 'reopen'}
        title="Reopen this ticket"
        label="Why is it being reopened?"
        confirmLabel="Reopen"
        minLength={5}
        onClose={() => setDialog(null)}
        onSubmit={(note) =>
          save(changeStatus(ticket, 'OPEN', actor, now(), note), 'Ticket reopened')
        }
      />
      <NoteModal
        open={dialog === 'note'}
        title="Add a note"
        description="Notes appear in the ticket’s history, which the customer can also read."
        label="Note"
        confirmLabel="Add note"
        minLength={2}
        onClose={() => setDialog(null)}
        onSubmit={(note) => save(addNote(note, actor, now()), 'Note added')}
      />
    </Card>
  )
}
