import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, db } from '../lib/supabase'
import { formatISTDateTime } from '../lib/datetime'
import {
  TASK_ASSIGNEES,
  TASK_FILTERS,
  compareActionableTasks,
  fetchTasks,
  isMissingTasksSchema,
  isTaskOverdue,
  readTaskPerson,
  taskMatchesAssignee,
  taskMatchesFilter,
  taskTypeLabel,
  writeTaskPerson,
} from '../lib/tasks'
import TaskForm from '../components/TaskForm'
import CompleteTaskDialog from '../components/CompleteTaskDialog'
import StatusPill from '../components/ui/StatusPill'
import EmptyState from '../components/ui/EmptyState'
import { ClipboardList, Plus } from 'lucide-react'

function statusTone(task, now) {
  if (task.status === 'completed') return 'ok'
  if (task.status === 'cancelled') return 'neutral'
  if (isTaskOverdue(task, now)) return 'danger'
  return 'warn'
}

function statusLabel(task, now) {
  if (task.status === 'completed') return 'Completed'
  if (task.status === 'cancelled') return 'Cancelled'
  if (isTaskOverdue(task, now)) return 'Overdue'
  return 'Pending'
}

export default function Tasks() {
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tasks, setTasks] = useState([])
  const [pumpsById, setPumpsById] = useState({})
  const [assignee, setAssignee] = useState('all')
  const [filter, setFilter] = useState('today')
  const [formOpen, setFormOpen] = useState(false)
  const [completing, setCompleting] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSchemaMissing(false)
    try {
      const [{ data: authData }, taskResult] = await Promise.all([
        supabase.auth.getUser(),
        fetchTasks(db),
      ])
      if (taskResult.error) {
        if (isMissingTasksSchema(taskResult.error)) {
          setSchemaMissing(true)
          setTasks([])
          return
        }
        throw taskResult.error
      }

      const rows = taskResult.data || []
      const pumpIds = [...new Set(rows.map((row) => row.pump_id).filter(Boolean))]
      let pumpMap = {}
      if (pumpIds.length > 0) {
        const { data: pumpRows, error: pumpError } = await db
          .from('pumps')
          .select('id, name, pump_code')
          .in('id', pumpIds)
        if (pumpError) throw pumpError
        pumpMap = Object.fromEntries((pumpRows || []).map((pump) => [pump.id, pump]))
      }

      if (!authData?.user) throw new Error('Sign in again to load tasks.')
      setTasks(rows)
      setPumpsById(pumpMap)
    } catch (loadError) {
      console.error('Tasks load error:', loadError)
      setError(loadError.message || 'Could not load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const now = new Date()
    const scoped = tasks.filter((task) => taskMatchesAssignee(task, assignee))
    const next = {}
    for (const item of TASK_FILTERS) {
      next[item.id] = scoped.filter((task) => taskMatchesFilter(task, item.id, now)).length
    }
    return next
  }, [tasks, assignee])

  const visible = useMemo(() => {
    const now = new Date()
    const rows = tasks.filter(
      (task) => taskMatchesAssignee(task, assignee) && taskMatchesFilter(task, filter, now)
    )
    if (filter === 'completed') {
      return rows.sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))
    }
    if (filter === 'cancelled') {
      return rows.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
    }
    return rows.sort((a, b) => compareActionableTasks(a, b, now))
  }, [tasks, filter, assignee])

  const pumpCount = useMemo(() => new Set(visible.map((task) => task.pump_id).filter(Boolean)).size, [visible])

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
      if (updateError) throw updateError
      setNotice('Task cancelled.')
      await load()
    } catch (cancelError) {
      setError(cancelError.message || 'Could not cancel the task')
    } finally {
      setCancellingId(null)
    }
  }

  const handleDelete = async (task) => {
    if (!confirm('Delete this task? This cannot be undone.')) return
    setDeletingId(task.id)
    setError('')
    try {
      const { error: deleteError } = await db.from('tasks').delete().eq('id', task.id)
      if (deleteError) throw deleteError
      setNotice('Task deleted.')
      await load()
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete the task')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="pf-page">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="pf-section-title flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-500" />
            Tasks
          </h1>
          <p className="pf-meta mt-1">Calls, demos, and follow-ups for registered pumps.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
        </div>
        {!formOpen && (
          <button type="button" onClick={() => setFormOpen(true)} className="pf-btn-primary w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            Add task
          </button>
        )}
      </div>

      {notice && <p className="mb-3 text-[13px] text-ok">{notice}</p>}
      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

      {schemaMissing && (
        <div className="mb-4 p-4 rounded-card bg-warn-soft">
          <p className="text-[14px] font-semibold text-ink">The tasks table is not in the database yet</p>
          <p className="text-[13px] text-ink-secondary mt-1">
            Run <span className="font-mono">tasks_table.sql</span> in the Supabase SQL editor, then reload this page.
          </p>
        </div>
      )}

      {formOpen && (
        <div className="mb-4">
          <TaskForm
            defaultAssignee={assignee === 'all' ? readTaskPerson() : assignee}
            onCancel={() => setFormOpen(false)}
            onCreated={() => {
              setFormOpen(false)
              setNotice('Task added.')
              load()
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {TASK_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`h-8 px-3 rounded-control text-[12px] font-semibold border transition-colors ${
              filter === item.id
                ? 'bg-brand-500 text-white border-transparent'
                : 'bg-surface text-ink-secondary border-line hover:bg-surface-muted'
            }`}
          >
            {item.label}
            <span className="ml-1.5 opacity-80">{counts[item.id] || 0}</span>
          </button>
        ))}
      </div>

      {!schemaMissing && (
        <p className="text-[12px] text-ink-muted mb-3">
          {visible.length} {visible.length === 1 ? 'task' : 'tasks'} · {pumpCount} {pumpCount === 1 ? 'pump' : 'pumps'}
        </p>
      )}

      {loading ? (
        <p className="text-[13px] text-ink-secondary">Loading tasks...</p>
      ) : schemaMissing ? null : visible.length === 0 ? (
        <div className="pf-card">
          <EmptyState
            title="No tasks in this list"
            description="Add a task, or switch filters to see other work."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((task) => {
            const pump = pumpsById[task.pump_id]
            const overdue = isTaskOverdue(task)
            return (
              <article key={task.id} className="pf-card p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-semibold text-ink break-words">{task.title}</h2>
                      {pump && (
                        <Link
                          to={`/pumps/${pump.id}/tasks`}
                          className="inline-flex h-6 items-center justify-center rounded-control border border-brand-500 bg-brand-500 px-2.5 text-[12px] font-semibold text-white hover:bg-brand-600"
                        >
                          Open pump
                        </Link>
                      )}
                      <StatusPill tone={statusTone(task)}>{statusLabel(task)}</StatusPill>
                      <StatusPill tone="info">{taskTypeLabel(task.task_type)}</StatusPill>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-secondary">
                      {pump?.name || 'Pump unavailable'}
                      {pump?.pump_code ? ` · ${pump.pump_code}` : ''}
                    </p>
                    <p className={`mt-1 text-[12px] ${overdue ? 'text-danger font-medium' : 'text-ink-muted'}`}>
                      Due {formatISTDateTime(task.due_at)}
                      {' · '}
                      {task.assigned_to || 'Unassigned'}
                    </p>
                    {task.outcome && (
                      <p className="mt-2 text-[13px] text-ink break-words">Outcome: {task.outcome}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0 sm:pt-0.5">
                    {task.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => setCompleting(task)}
                        className="inline-flex h-10 w-full sm:w-auto items-center justify-center rounded-control bg-ok px-4 text-[14px] font-semibold text-white hover:opacity-90"
                      >
                        Complete
                      </button>
                    )}
                    {task.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(task)}
                        disabled={cancellingId === task.id}
                        className="inline-flex h-10 w-full sm:w-auto items-center justify-center rounded-control bg-brand-500 px-4 text-[14px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                      >
                        {cancellingId === task.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(task)}
                      disabled={deletingId === task.id}
                      className="inline-flex h-10 w-full sm:w-auto items-center justify-center rounded-control bg-danger px-4 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {deletingId === task.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

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
