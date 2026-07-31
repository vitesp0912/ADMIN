import { Link } from 'react-router-dom'
import StatusPill from './StatusPill'

const TONE_BAR = {
  danger: 'border-l-danger',
  warn: 'border-l-warn',
  info: 'border-l-info',
  ok: 'border-l-ok',
  neutral: 'border-l-line-strong',
}

export default function AlertList({ items = [], emptyText = 'No alerts right now' }) {
  if (!items.length) {
    return (
      <div className="px-4 py-8 text-center text-[13px] text-ink-muted">{emptyText}</div>
    )
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const body = (
          <div
            className={`px-4 py-3 border-l-[3px] ${TONE_BAR[item.tone] || TONE_BAR.neutral} hover:bg-surface-muted/60 transition-colors`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <StatusPill tone={item.tone || 'neutral'}>{item.severity || 'Info'}</StatusPill>
                  <p className="text-[13px] font-semibold text-ink truncate">{item.title}</p>
                </div>
                {item.detail && (
                  <p className="text-[12px] text-ink-secondary">{item.detail}</p>
                )}
              </div>
              {item.actionLabel && (
                <span className="text-[12px] font-medium text-brand-600 dark:text-brand-300 shrink-0">
                  {item.actionLabel}
                </span>
              )}
            </div>
          </div>
        )

        return (
          <li key={item.id}>
            {item.href ? <Link to={item.href}>{body}</Link> : item.onClick ? (
              <button type="button" className="w-full text-left" onClick={item.onClick}>
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        )
      })}
    </ul>
  )
}
