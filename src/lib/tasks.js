import { getISTDayKey } from './datetime'

export const TASK_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'demo', label: 'Demo' },
  { value: 'follow_up', label: 'Follow-up' },
]

export const TASK_FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'pending', label: 'All Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

export const TASK_ASSIGNEES = ['Anurag', 'Abhinandan']

const TASK_PERSON_KEY = 'petrofi.taskPerson'

const TYPE_LABELS = Object.fromEntries(TASK_TYPES.map((item) => [item.value, item.label]))

export function taskTypeLabel(type) {
  return TYPE_LABELS[type] || type || '—'
}

export function readTaskPerson() {
  try {
    const saved = localStorage.getItem(TASK_PERSON_KEY)
    if (TASK_ASSIGNEES.includes(saved)) return saved
  } catch {
    /* ignore */
  }
  return TASK_ASSIGNEES[0]
}

export function writeTaskPerson(name) {
  if (!TASK_ASSIGNEES.includes(name)) return
  try {
    localStorage.setItem(TASK_PERSON_KEY, name)
  } catch {
    /* ignore */
  }
}

export function displayNameFromAuthUser(user) {
  if (!user) return ''
  const meta = user.user_metadata || {}
  const name =
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
    ''
  if (String(name).trim()) return String(name).trim()
  if (user.email) return user.email.split('@')[0]
  return 'Teammate'
}

export function isoToDatetimeLocalIST(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  let hour = get('hour')
  if (hour === '24') hour = '00'
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

export function datetimeLocalISTToIso(value) {
  if (!value) return null
  const date = new Date(`${value}:00+05:30`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function isTaskOverdue(task, now = new Date()) {
  if (!task?.due_at || task.status !== 'pending') return false
  const due = new Date(task.due_at)
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime()
}

export function isTaskDueToday(task, now = new Date()) {
  if (!task?.due_at) return false
  const dueKey = getISTDayKey(task.due_at)
  return Boolean(dueKey) && dueKey === getISTDayKey(now)
}

export function taskMatchesAssignee(task, assignee) {
  if (!assignee || assignee === 'all') return true
  return task?.assigned_to === assignee
}

export function isDueDateAllowed(localValue, now = new Date()) {
  if (!localValue || !String(localValue).includes('T')) return false
  const day = String(localValue).slice(0, 10)
  return day >= getISTDayKey(now)
}

export function taskMatchesFilter(task, filterId, now = new Date()) {
  if (!task) return false
  if (filterId === 'completed') return task.status === 'completed'
  if (filterId === 'cancelled') return task.status === 'cancelled'
  if (task.status !== 'pending') return false
  if (filterId === 'overdue') return isTaskOverdue(task, now)
  if (filterId === 'today') return isTaskDueToday(task, now) || isTaskOverdue(task, now)
  if (filterId === 'pending') return true
  return false
}

export function compareActionableTasks(a, b, now = new Date()) {
  const aOver = isTaskOverdue(a, now)
  const bOver = isTaskOverdue(b, now)
  if (aOver !== bOver) return aOver ? -1 : 1
  return new Date(a.due_at) - new Date(b.due_at)
}

export function isMissingTasksSchema(error) {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  return error?.code === '42P01' || error?.code === '42883' || text.includes('tasks') || text.includes('complete_admin_task')
}

export async function fetchPumpChoices(client) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; from < 10000; from += pageSize) {
    const { data, error } = await client
      .from('pumps')
      .select('id, name, pump_code')
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

export async function fetchTasks(client) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; from < 10000; from += pageSize) {
    const { data, error } = await client
      .from('tasks')
      .select('id, pump_id, title, task_type, assigned_to, due_at, status, outcome, completed_at, created_by, created_at, updated_at, note_id')
      .order('due_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return { data: rows, error: null }
}
