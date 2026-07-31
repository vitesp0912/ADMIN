const TONES = {
  ok: 'bg-ok-soft text-ok border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  neutral: 'bg-surface-muted text-ink-secondary border-line',
}

export default function StatusPill({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 h-5 px-2 rounded-md text-[11px] font-semibold leading-none border capitalize ${TONES[tone] || TONES.neutral} ${className}`}
    >
      {children}
    </span>
  )
}
