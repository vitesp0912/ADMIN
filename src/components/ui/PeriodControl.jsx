const OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
]

export default function PeriodControl({ value = '30d', onChange }) {
  return (
    <div
      className="inline-flex p-0.5 rounded-control border border-line bg-surface-muted"
      role="group"
      aria-label="Date period"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange?.(opt.id)}
            className={`h-8 px-3 rounded-[6px] text-[12px] font-semibold transition-colors duration-100 ${
              active
                ? 'bg-surface text-ink shadow-soft'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
