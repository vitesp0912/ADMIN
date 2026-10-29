import { useState } from 'react'
import { supabase, db } from '../lib/supabase'
import {
  TASK_ASSIGNEES,
  TASK_TYPES,
  datetimeLocalISTToIso,
  displayNameFromAuthUser,
  isDueDateAllowed,
} from '../lib/tasks'
import DueDateTimeField from './DueDateTimeField'

export default function CompleteTaskDialog({ task, onClose, onCompleted }) {
  const [outcome, setOutcome] = useState('')
  const [note, setNote] = useState('')
  const [scheduleNext, setScheduleNext] = useState(false)
  const [nextTitle, setNextTitle] = useState('')
  const [nextType, setNextType] = useState('follow_up')
  const [nextAssignee, setNextAssignee] = useState(
    TASK_ASSIGNEES.includes(task?.assigned_to) ? task.assigned_to : TASK_ASSIGNEES[0]
  )
  const [nextDue, setNextDue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    let nextDueIso = null
    if (scheduleNext) {
      const title = nextTitle.trim()
      nextDueIso = datetimeLocalISTToIso(nextDue)
      if (!title) {
        setError('Enter a title for the next task.')
        return
      }
      if (!nextAssignee) {
        setError('Choose who will do the next task.')
        return
      }
      if (!nextDueIso || !isDueDateAllowed(nextDue)) {
        setError('Choose today or a later date, and a time.')
        return
      }
    }

    setSaving(true)
    setError('')
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) throw new Error('Sign in again before completing a task.')

      const { error: rpcError } = await db.rpc('complete_admin_task', {
        p_task_id: task.id,
        p_outcome: outcome.trim(),
        p_note_body: note.trim(),
        p_author_name: displayNameFromAuthUser(authData.user),
        p_actor_id: authData.user.id,
        p_schedule_next: scheduleNext,
        p_next_title: scheduleNext ? nextTitle.trim() : '',
        p_next_type: scheduleNext ? nextType : 'follow_up',
        p_next_assigned_to: scheduleNext ? nextAssignee : null,
        p_next_due_at: nextDueIso,
      })
      if (rpcError) throw rpcError
      onCompleted?.()
    } catch (saveError) {
      setError(saveError.message || 'Could not complete the task')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
      <form onSubmit={handleSubmit} className="bg-surface rounded-card shadow-soft w-full min-w-0 max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-ink">Complete task</h3>
            <p className="text-[13px] text-ink-secondary mt-1 break-words">{task.title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="pf-btn-ghost !px-2" aria-label="Close">
            ×
          </button>
        </div>

        <label className="block mb-3">
          <span className="block text-[12px] font-medium text-ink-secondary mb-1">Outcome</span>
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={3}
            placeholder="Owner asked to call again on Monday"
            className="pf-input !h-auto py-2 resize-y w-full"
            disabled={saving}
          />
        </label>

        <label className="block mb-3">
          <span className="block text-[12px] font-medium text-ink-secondary mb-1">Note for the pump (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Saved on the pump notes only if you write something here"
            className="pf-input !h-auto py-2 resize-y w-full"
            disabled={saving}
          />
        </label>

        <label className="flex items-center gap-2 text-[13px] text-ink mb-3">
          <input
            type="checkbox"
            checked={scheduleNext}
            onChange={(e) => setScheduleNext(e.target.checked)}
            disabled={saving}
          />
          Schedule the next follow-up
        </label>

        {scheduleNext && (
          <div className="space-y-3 mb-3 rounded-control border border-line p-3">
            <label className="block">
              <span className="block text-[12px] font-medium text-ink-secondary mb-1">Next title</span>
              <input
                value={nextTitle}
                onChange={(e) => setNextTitle(e.target.value)}
                className="pf-input w-full"
                disabled={saving}
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[12px] font-medium text-ink-secondary mb-1">Type</span>
                <select
                  value={nextType}
                  onChange={(e) => setNextType(e.target.value)}
                  className="pf-input w-full"
                  disabled={saving}
                >
                  {TASK_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-ink-secondary mb-1">Assigned to</span>
                <select
                  value={nextAssignee}
                  onChange={(e) => setNextAssignee(e.target.value)}
                  className="pf-input w-full"
                  disabled={saving}
                >
                  {TASK_ASSIGNEES.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <p className="text-[12px] font-medium text-ink-secondary mb-1">Due date and time</p>
              <DueDateTimeField value={nextDue} onChange={setNextDue} disabled={saving} />
            </div>
          </div>
        )}

        {error && <p className="text-[13px] text-danger mb-3">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="pf-btn-secondary w-full sm:w-auto">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="pf-btn-primary w-full sm:w-auto">
            {saving ? 'Saving...' : 'Mark completed'}
          </button>
        </div>
      </form>
    </div>
  )
}
