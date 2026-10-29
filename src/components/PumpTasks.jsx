import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import { formatISTDateTime } from '../lib/datetime'
import {
  TASK_ASSIGNEES,
  compareActionableTasks,
  isMissingTasksSchema,
  isTaskOverdue,
  readTaskPerson,
  taskTypeLabel,
  writeTaskPerson,
} from '../lib/tasks'
import TaskForm from './TaskForm'
import CompleteTaskDialog from './CompleteTaskDialog'
import StatusPill from './ui/StatusPill'
import EmptyState from './ui/EmptyState'
import { ClipboardList, Plus } from 'lucide-react'

function statusTone(task) {
  if (task.status === 'completed') return 'ok'
  if (task.status === 'cancelled') return 'neutral'
  if (isTaskOverdue(task)) return 'danger'
  return 'warn'
}

function statusLabel(task) {
  if (task.status === 'completed') return 'Completed'
  if (task.status === 'cancelled') return 'Cancelled'
  if (isTaskOverdue(task)) return 'Overdue'
  return 'Pending'
}

function sortPumpTasks(rows) {
  const pending = rows.filter((task) => task.status === 'pending').sort(compareActionableTasks)
  const completed = rows
    .filter((task) => task.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))
  const cancelled = rows
    .filter((task) => task.status === 'cancelled')
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
  return [...pending, ...completed, ...cancelled]
}

export default function PumpTasks({ pumpId, pumpName }) {
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tasks, setTasks] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [assignee, setAssignee] = useState('all')
  const [completing, setCompleting] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async () => {
    if (!pumpId) return
    setLoading(true)
    setError('')
    setSchemaMissing(false)
    try {
      const { data, error: loadError } = await db
        .from('tasks')
        .select('id, pump_id, title, task_type, assigned_to, due_at, status, outcome, completed_at, created_at, updated_at')
        .eq('pump_id', pumpId)
        .order('due_at', { ascending: true })

      if (loadError) {
        if (isMissingTasksSchema(loadError)) {
          setSchemaMissing(true)
          setTasks([])
          return
        }
        throw loadError
      }
      setTasks(sortPumpTasks(data || []))
    } catch (err) {
      setError(err.message || 'Could not load tasks')
    } finally {
      setLoading(false)
    }
  }, [pumpId])

  useEffect(() => {
    load()
  }, [load])

  const handleCancel = async (task) => {
    if (!confirm('Cancel this task? It leaves the pending lists and stays in Cancelled.')) return
    setCancellingId(task.id)
    setError('')
    try {
      const { error: updateError } = await db
        .from('tasks')
        .update({ status: 'cancelled' })
        .eq('id', task.id)
        .eq('status', 'pending')
        .eq('pump_id', pumpId)
      if (updateError) throw updateError
      setNotice('Task cancelled.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not cancel the task')
    } finally {
      setCancellingId(null)
    }
  }

  const handleDelete = async (task) => {
    if (!confirm('Delete this task? This cannot be undone.')) return
    setDeletingId(task.id)
    setError('')
    try {
      const { error: deleteError } = await db
        .from('tasks')
        .delete()
        .eq('id', task.id)
        .eq('pump_id', pumpId)
      if (deleteError) throw deleteError
      setNotice('Task deleted.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not delete the task')
    } finally {
      setDeletingId(null)
    }
  }

  const visible = tasks.filter((task) => assignee === 'all' || task.assigned_to === assignee)

  return (
    <div className="animate-fade-in">
      <div className="pf-card overflow-hidden">
        <div className="pf-card-header !py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="min-w-0">
              <h2 className="pf-section-title flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-brand-500 shrink-0" />
                <span className="truncate">Tasks</span>
              </h2>
              <p className="pf-meta mt-0.5">Calls, demos, and follow-ups for this pump</p>
            </div>
            {!formOpen && (
              <button
                type="button"
                onClick={() => {
                  setNotice('')
                  setFormOpen(true)
                }}
                className="pf-btn-primary w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Add task
              </button>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-5 min-w-0 space-y-3">
          {notice && <p className="text-[13px] text-ok">{notice}</p>}
          {error && <p className="text-[13px] text-danger">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-secondary">Assignee</span>
            <button
              type="button"
              onClick={() => setAssignee('all')}
              className={`h-7 px-2.5 rounded-control text-[12px] font-semibold border ${
                assignee === 'all'
                  ? 'bg-brand-500 text-white border-transparent'
                  : 'bg-surface text-ink-secondary border-line'
              }`}
            >
              All
            </button>
            {TASK_ASSIGNEES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setAssignee(name)
                  writeTaskPerson(name)
                }}
                className={`h-7 px-2.5 rounded-control text-[12px] font-semibold border ${
                  assignee === name
                    ? 'bg-brand-500 text-white border-transparent'
                    : 'bg-surface text-ink-secondary border-line'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {schemaMissing && (
            <div className="p-4 rounded-card bg-warn-soft">
              <p className="text-[14px] font-semibold text-ink">The tasks table is not in the database yet</p>
              <p className="text-[13px] text-ink-secondary mt-1">
                Run <span className="font-mono">tasks_table.sql</span> in the Supabase SQL editor, then reload this page.
              </p>
            </div>
          )}

          {formOpen && (
            <TaskForm
              fixedPump={{ id: pumpId, name: pumpName }}
              defaultAssignee={assignee === 'all' ? readTaskPerson() : assignee}
              onCancel={() => setFormOpen(false)}
              onCreated={() => {
                setFormOpen(false)
                setNotice('Task added for this pump.')
                load()
              }}
            />
          )}

          {loading ? (
            <p className="text-[13px] text-ink-secondary">Loading tasks...</p>
          ) : schemaMissing ? null : visible.length === 0 ? (
            <EmptyState
              title={assignee === 'all' ? 'No tasks for this pump' : `No tasks for ${assignee}`}
              description="Add a call, demo, or follow-up."
              action={
                !formOpen ? (
                  <button type="button" onClick={() => setFormOpen(true)} className="pf-btn-primary">
                    <Plus className="w-4 h-4" />
                    Add task
                  </button>
                ) : null
              }
            />
          ) : (
            visible.map((task) => {
              const overdue = isTaskOverdue(task)
              return (
                <article key={task.id} className="rounded-card border border-line bg-surface p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-ink break-words">{task.title}</h3>
                        <StatusPill tone={statusTone(task)}>{statusLabel(task)}</StatusPill>
                        <StatusPill tone="info">{taskTypeLabel(task.task_type)}</StatusPill>
                      </div>
                      <p className={`mt-1 text-[12px] ${overdue ? 'text-danger font-medium' : 'text-ink-muted'}`}>
                        Due {formatISTDateTime(task.due_at)}
                        {' · '}
                        {task.assigned_to || 'Unassigned'}
                      </p>
                      {task.outcome && (
                        <p className="mt-2 text-[13px] text-ink break-words">Outcome: {task.outcome}</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      {task.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(task)}
                          disabled={cancellingId === task.id}
                          className="pf-btn-primary w-full sm:w-auto"
                        >
                          {cancellingId === task.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                      {task.status === 'pending' && (
                        <button type="button" onClick={() => setCompleting(task)} className="pf-btn-secondary w-full sm:w-auto">
                          Complete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(task)}
                        disabled={deletingId === task.id}
                        className="pf-btn-ghost w-full sm:w-auto text-danger"
                      >
                        {deletingId === task.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>

      {completing && (
        <CompleteTaskDialog
          task={completing}
          onClose={() => setCompleting(null)}
          onCompleted={() => {
            setCompleting(null)
            setNotice('Task completed.')
            load()
          }}
        />
      )}
    </div>
  )
}
