import { Link } from 'react-router-dom'
import StatusPill from './StatusPill'
import Sparkline from './Sparkline'

const STATUS_BAR = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-line-strong',
}

export default function KpiCard({
  title,
  value,
  meta,
  trend,
  trendTone = 'neutral',
  status,
  statusLabel,
  sparkline,
  href,
  variant = 'default',
  onClick,
}) {
  const Comp = href ? Link : onClick ? 'button' : 'div'
  const props = href ? { to: href } : onClick ? { type: 'button', onClick } : {}

  return (
    <Comp
      {...props}
      className={`pf-card relative overflow-hidden text-left w-full transition-colors duration-100 hover:bg-surface-elevated ${
        href || onClick ? 'cursor-pointer' : ''
      } ${variant === 'hero' ? 'sm:col-span-2 xl:col-span-1' : ''}`}
    >
      {status && status !== 'neutral' && (
        <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${STATUS_BAR[status] || STATUS_BAR.neutral}`} />
      )}
      <div className="p-5 pl-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="pf-label">{title}</p>
          <div className="flex items-center gap-2">
            {trend != null && (
              <StatusPill tone={trendTone}>{trend}</StatusPill>
            )}
            {statusLabel && (
              <StatusPill tone={status || 'neutral'}>{statusLabel}</StatusPill>
            )}
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className={variant === 'hero' ? 'pf-value' : 'pf-value-md'}>{value}</p>
            {meta && <p className="pf-meta mt-1.5">{meta}</p>}
          </div>
          {sparkline?.length > 1 && (
            <Sparkline values={sparkline} className="text-brand-500 shrink-0 mb-1" />
          )}
        </div>
      </div>
    </Comp>
  )
}
