/** Pump lifecycle states (matches public.pumps.pump_state check constraint) */
export const PUMP_STATES = [
  {
    value: 'discovery_pending',
    label: 'Discovery pending',
    tone: 'info',
    order: 1,
    selectClass:
      'border-blue-200 text-blue-700 bg-blue-50 dark:border-blue-500/50 dark:text-blue-300 dark:bg-blue-950',
  },
  {
    value: 'setup_pending',
    label: 'Setup pending',
    tone: 'warn',
    order: 2,
    selectClass:
      'border-amber-200 text-amber-800 bg-amber-50 dark:border-amber-500/50 dark:text-amber-300 dark:bg-amber-950',
  },
  {
    value: 'demo_pending',
    label: 'Demo pending',
    tone: 'demo',
    order: 3,
    selectClass:
      'border-violet-200 text-violet-700 bg-violet-50 dark:border-violet-500/50 dark:text-violet-300 dark:bg-violet-950',
  },
  {
    value: 'activated',
    label: 'Activated',
    tone: 'ok',
    order: 4,
    selectClass:
      'border-green-200 text-green-700 bg-green-50 dark:border-green-500/50 dark:text-green-300 dark:bg-green-950',
  },
  {
    value: 'followup_pending',
    label: 'Followup pending',
    tone: 'followup',
    order: 5,
    selectClass:
      'border-orange-200 text-orange-700 bg-orange-50 dark:border-orange-500/50 dark:text-orange-300 dark:bg-orange-950',
  },
]

const BY_VALUE = Object.fromEntries(PUMP_STATES.map((s) => [s.value, s]))

const NEUTRAL_SELECT_CLASS =
  'border-line text-ink-secondary bg-surface-muted dark:border-line dark:text-ink-secondary dark:bg-surface-muted'

const BASE_SELECT_CLASS =
  'w-full min-w-[140px] max-w-[168px] h-8 px-2 border rounded-control text-[12px] font-medium transition-colors disabled:opacity-60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400'

export function getPumpStateMeta(state) {
  if (!state) {
    return {
      value: null,
      label: '—',
      tone: 'neutral',
      order: 99,
      selectClass: NEUTRAL_SELECT_CLASS,
    }
  }
  return (
    BY_VALUE[state] || {
      value: state,
      label: state.replace(/_/g, ' '),
      tone: 'neutral',
      order: 99,
      selectClass: NEUTRAL_SELECT_CLASS,
    }
  )
}

export function comparePumpState(a, b) {
  const orderA = getPumpStateMeta(a?.pump_state).order
  const orderB = getPumpStateMeta(b?.pump_state).order
  if (orderA !== orderB) return orderA - orderB
  return (a?.name || '').localeCompare(b?.name || '', 'en-IN')
}

export function getPumpStateSelectClass(state) {
  const meta = getPumpStateMeta(state)
  return `${BASE_SELECT_CLASS} ${meta.selectClass || NEUTRAL_SELECT_CLASS}`
}
