import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/supabase'
import { formatCount } from '../lib/format'
import { formatISTDate, formatISTDateTime, getISTDayKey } from '../lib/datetime'
import { compareActionableTasks, isMissingTasksSchema, isTaskOverdue, taskMatchesFilter } from '../lib/tasks'
import KpiCard from '../components/ui/KpiCard'
import StatusPill from '../components/ui/StatusPill'
import EmptyState from '../components/ui/EmptyState'
import { DashboardSkeleton } from '../components/ui/Skeleton'

function istDayRange(now = new Date()) {
  const startKey = getISTDayKey(now)
  const [year, month, day] = startKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  const endKey = [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0'),
  ].join('-')
  return {
    start: new Date(`${startKey}T00:00:00+05:30`).toISOString(),
    end: new Date(`${endKey}T00:00:00+05:30`).toISOString(),
  }
}

function dueTone(task) {
  return isTaskOverdue(task) ? 'danger' : 'warn'
}

function dueLabel(task) {
  return isTaskOverdue(task) ? 'Due' : 'Today'
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPumps: 0,
    activePumps: 0,
    pendingPumps: 0,
  })
  const [loading, setLoading] = useState(true)
  const [dueTasks, setDueTasks] = useState([])
  const [tasksError, setTasksError] = useState('')
  const [schemaMissing, setSchemaMissing] = useState(false)
  const todayLabel = formatISTDate(new Date())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const range = istDayRange()
        const [pumpsRes, tasksRes] = await Promise.all([
          db.from('pumps').select('id, is_active, registration_status'),
          db
            .from('tasks')
            .select('id, title, due_at, assigned_to, status, pump_id, pumps(id, name, pump_code)')
            .eq('status', 'pending')
            .lt('due_at', range.end)
            .order('due_at', { ascending: true })
            .limit(1000),
        ])

        if (cancelled) return
        if (pumpsRes.error) throw pumpsRes.error

        const pumps = pumpsRes.data || []
        setStats({
          totalPumps: pumps.length,
          activePumps: pumps.filter((p) => p.is_active).length,
          pendingPumps: pumps.filter((p) => p.registration_status === 'pending').length,
        })

        if (tasksRes.error) {
          if (isMissingTasksSchema(tasksRes.error)) {
            setSchemaMissing(true)
            setDueTasks([])
            return
          }
          throw tasksRes.error
        }

        const now = new Date()
        const rows = (tasksRes.data || [])
          .filter((task) => taskMatchesFilter(task, 'today', now))
          .sort((a, b) => compareActionableTasks(a, b, now))
        setDueTasks(rows)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        if (!cancelled) setTasksError(error.message || 'Could not load due tasks')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const statCards = useMemo(
    () => [
      {
        title: 'Total pumps',
        value: formatCount(stats.totalPumps),
        meta: 'All registered pumps',
        href: '/pumps',
        status: 'neutral',
      },
      {
        title: 'Active pumps',
        value: formatCount(stats.activePumps),
        meta: 'Currently active',
        href: '/pumps',
        status: 'ok',
        statusLabel: 'Live',
      },
      {
        title: 'Pending registrations',
        value: formatCount(stats.pendingPumps),
        meta: 'Awaiting approval',
        href: '/pumps',
        status: stats.pendingPumps > 0 ? 'warn' : 'ok',
        statusLabel: stats.pendingPumps > 0 ? 'Action' : 'Clear',
      },
    ],
    [stats]
  )

  if (loading) return <DashboardSkeleton />

  return (
    <div className="pf-page space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="pf-meta mt-1">Manage pumps and registrations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {statCards.map((card) => (
          <KpiCard
            key={card.title}
            title={card.title}
            value={card.value}
            meta={card.meta}
            href={card.href}
            status={card.status}
            statusLabel={card.statusLabel}
          />
        ))}
      </div>

      <div className="pf-card overflow-hidden">
        <div className="pf-card-header">
          <div className="min-w-0">
            <h2 className="pf-section-title">Due and today&apos;s tasks</h2>
            <p className="pf-meta mt-0.5">Overdue tasks, and tasks due {todayLabel}</p>
          </div>
          <Link to="/tasks" className="text-[12px] font-medium text-brand-600 dark:text-brand-300 shrink-0">
            View all tasks
          </Link>
        </div>

        {schemaMissing ? (
          <div className="p-4 sm:p-5">
            <p className="text-[14px] font-semibold text-ink">The tasks table is not in the database yet</p>
            <p className="text-[13px] text-ink-secondary mt-1">
              Run <span className="font-mono">tasks_table.sql</span> in the Supabase SQL editor, then reload this page.
            </p>
          </div>
        ) : tasksError ? (
          <div className="p-4 sm:p-5">
            <p className="text-[13px] text-danger">{tasksError}</p>
          </div>
        ) : dueTasks.length === 0 ? (
          <EmptyState
            title="No due or today's tasks"
            description="Overdue tasks and tasks scheduled for today will show up here."
            action={<Link to="/tasks" className="pf-btn-primary">Go to tasks</Link>}
          />
        ) : (
          <>
            <ul className="md:hidden divide-y divide-line">
              {dueTasks.map((task) => {
                const pump = Array.isArray(task.pumps) ? task.pumps[0] : task.pumps
                return (
                  <li key={task.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-semibold text-ink break-words">{task.title}</p>
                      <StatusPill tone={dueTone(task)}>{dueLabel(task)}</StatusPill>
                    </div>
                    <dl className="grid grid-cols-1 gap-1.5 text-[13px]">
                      <div className="min-w-0">
                        <dt className="text-[11px] text-ink-muted">Pump</dt>
                        <dd className="break-words">
                          {pump ? (
                            <Link to={`/pumps/${pump.id}/tasks`} className="font-medium text-brand-600 dark:text-brand-300">
                              <span className="font-mono">{pump.pump_code || 'No code'}</span>
                              {pump.name ? <span className="text-ink"> · {pump.name}</span> : null}
                            </Link>
                          ) : (
                            <span className="text-ink-secondary">Pump unavailable</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-ink-muted">Due</dt>
                        <dd className="text-ink">{formatISTDateTime(task.due_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-ink-muted">Assignee</dt>
                        <dd className="text-ink">{task.assigned_to || 'Unassigned'}</dd>
                      </div>
                    </dl>
                  </li>
                )
              })}
            </ul>

            <div className="hidden md:block pf-table-wrap !border-0 !rounded-none">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Pump</th>
                    <th>Task</th>
                    <th>Due</th>
                    <th>Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {dueTasks.map((task) => {
                    const pump = Array.isArray(task.pumps) ? task.pumps[0] : task.pumps
                    return (
                      <tr key={task.id}>
                        <td className="min-w-[10rem]">
                          {pump ? (
                            <Link to={`/pumps/${pump.id}/tasks`} className="block">
                              <span className="font-mono text-[12px] text-brand-600 dark:text-brand-300">{pump.pump_code || 'No code'}</span>
                              {pump.name ? <span className="block text-[13px] font-medium text-ink">{pump.name}</span> : null}
                            </Link>
                          ) : (
                            <span className="text-ink-secondary">Pump unavailable</span>
                          )}
                        </td>
                        <td className="font-medium">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span className="break-words">{task.title}</span>
                            <StatusPill tone={dueTone(task)}>{dueLabel(task)}</StatusPill>
                          </span>
                        </td>
                        <td className="text-ink-secondary whitespace-nowrap">{formatISTDateTime(task.due_at)}</td>
                        <td className="whitespace-nowrap">{task.assigned_to || 'Unassigned'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
