import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, db } from '../lib/supabase'
import {
  TASK_ASSIGNEES,
  TASK_TYPES,
  datetimeLocalISTToIso,
  fetchPumpChoices,
  isDueDateAllowed,
} from '../lib/tasks'
import DueDateTimeField from './DueDateTimeField'

const emptyForm = {
  pumpId: '',
  pumpQuery: '',
  title: '',
  taskType: 'call',
  assignedTo: '',
  dueAt: '',
}

export default function TaskForm({ fixedPump = null, defaultAssignee = 'Anurag', onCancel, onCreated }) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    pumpId: fixedPump?.id || '',
    pumpQuery: fixedPump?.name || '',
    assignedTo: TASK_ASSIGNEES.includes(defaultAssignee) ? defaultAssignee : TASK_ASSIGNEES[0],
  }))
  const [pumps, setPumps] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(!fixedPump?.id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pumpListOpen, setPumpListOpen] = useState(false)
  const pumpInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingOptions(true)
      setError('')
      try {
        const [authResult, pumpRows] = await Promise.all([
          supabase.auth.getUser(),
          fixedPump?.id ? Promise.resolve([]) : fetchPumpChoices(db),
        ])
        if (cancelled) return
        if (!authResult.data?.user) throw new Error('Sign in again before adding a task.')
        setPumps(pumpRows || [])
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Could not load the task form')
      } finally {
        if (!cancelled) setLoadingOptions(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [fixedPump?.id])

  const matches = useMemo(() => {
    const q = form.pumpQuery.trim().toLowerCase()
    const sorted = [...pumps].sort((a, b) =>
      String(a.pump_code || '').localeCompare(String(b.pump_code || ''), undefined, { numeric: true, sensitivity: 'base' })
    )
    if (!q) return sorted
    return sorted.filter((pump) => String(pump.pump_code || '').toLowerCase().includes(q))
  }, [pumps, form.pumpQuery])

  const selectedPump = fixedPump || pumps.find((pump) => pump.id === form.pumpId) || null

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    const title = form.title.trim()
    const dueAt = datetimeLocalISTToIso(form.dueAt)
    if (!selectedPump?.id) {
      setError('Choose a pump.')
      return
    }
    if (!title) {
      setError('Enter a task title.')
      return
    }
    if (title.length > 160) {
      setError('Title must be 160 characters or less.')
      return
    }
    if (!TASK_TYPES.some((item) => item.value === form.taskType)) {
      setError('Choose call, demo, or follow-up.')
      return
    }
    if (!form.assignedTo) {
      setError('Choose who will do this task.')
      return
    }
    if (!dueAt || !isDueDateAllowed(form.dueAt)) {
      setError('Choose today or a later date, and a time.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) throw new Error('Sign in again before adding a task.')

      const { error: insertError } = await db.from('tasks').insert({
        pump_id: selectedPump.id,
        title,
        task_type: form.taskType,
        assigned_to: form.assignedTo,
        due_at: dueAt,
        status: 'pending',
        created_by: authData.user.id,
      })
      if (insertError) throw insertError
      onCreated?.()
    } catch (saveError) {
      setError(saveError.message || 'Could not save the task')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-line bg-surface p-3 sm:p-4 space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink">Add task</p>
        <button type="button" onClick={onCancel} disabled={saving} className="pf-btn-ghost !px-2">
          Close
        </button>
      </div>

      {fixedPump ? (
        <p className="text-[13px] text-ink-secondary">
          Pump: <span className="font-medium text-ink">{fixedPump.name}</span>
        </p>
      ) : (
        <label className="block">
          <span className="block text-[12px] font-medium text-ink-secondary mb-1">Pump</span>
          <input
            ref={pumpInputRef}
            value={form.pumpQuery}
            onChange={(e) => setForm((prev) => ({ ...prev, pumpQuery: e.target.value, pumpId: '' }))}
            onFocus={() => setPumpListOpen(true)}
            onBlur={() => setPumpListOpen(false)}
            placeholder="Search by pump code"
            className="pf-input w-full"
            disabled={saving || loadingOptions}
            autoComplete="off"
          />
          {selectedPump && !pumpListOpen ? (
            <p className="mt-1 text-[12px] text-ink break-words">
              Selected: <span className="font-mono font-medium">{selectedPump.pump_code || 'No code'}</span>
              {selectedPump.name ? <span className="text-ink-secondary"> · {selectedPump.name}</span> : null}
            </p>
          ) : null}
          {pumpListOpen ? (
            <ul
              className="mt-1 border border-line rounded-control overflow-y-auto max-h-48 sm:max-h-64"
              onPointerDown={(event) => event.preventDefault()}
            >
              {loadingOptions ? (
                <li className="px-3 py-2 text-[12px] text-ink-muted">Loading pumps...</li>
              ) : matches.length === 0 ? (
                <li className="px-3 py-2 text-[12px] text-ink-muted">No pumps match that code.</li>
              ) : (
                matches.map((pump) => (
                  <li key={pump.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-muted min-w-0"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          pumpId: pump.id,
                          pumpQuery: pump.pump_code || '',
                        }))
                        setPumpListOpen(false)
                        pumpInputRef.current?.blur()
                      }}
                    >
                      <span className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 min-w-0">
                        <span className="font-mono font-medium text-ink shrink-0">{pump.pump_code || 'No code'}</span>
                        {pump.name ? <span className="text-ink-secondary break-words">{pump.name}</span> : null}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </label>
      )}

      <label className="block">
        <span className="block text-[12px] font-medium text-ink-secondary mb-1">Title</span>
        <input
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          maxLength={160}
          placeholder="Call Sharma Petrol Pump"
          className="pf-input w-full"
          disabled={saving}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[12px] font-medium text-ink-secondary mb-1">Type</span>
          <select
            value={form.taskType}
            onChange={(e) => setForm((prev) => ({ ...prev, taskType: e.target.value }))}
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
            value={form.assignedTo}
            onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
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
        <DueDateTimeField
          value={form.dueAt}
          onChange={(dueAt) => setForm((prev) => ({ ...prev, dueAt }))}
          disabled={saving}
        />
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="pf-btn-secondary w-full sm:w-auto">
          Cancel
        </button>
        <button type="submit" disabled={saving || loadingOptions} className="pf-btn-primary w-full sm:w-auto">
          {saving ? 'Saving...' : 'Save task'}
        </button>
      </div>
    </form>
  )
}
