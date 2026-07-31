export function AreaChart({
  series = [],
  compare = [],
  labels = [],
  height = 180,
  valuePrefix = '₹',
}) {
  const w = 560
  const h = height
  const pad = { t: 12, r: 12, b: 28, l: 44 }
  const all = [...series, ...compare]
  const max = Math.max(...all, 1)
  const n = Math.max(series.length, 1)

  const xAt = (i) => pad.l + (i / Math.max(n - 1, 1)) * (w - pad.l - pad.r)
  const yAt = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b)

  const linePath = (vals) =>
    vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(v)}`)
      .join(' ')

  const areaPath =
    series.length > 1
      ? `${linePath(series)} L ${xAt(series.length - 1)} ${h - pad.b} L ${xAt(0)} ${h - pad.b} Z`
      : ''

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Trend chart">
        {[0, 0.5, 1].map((t) => {
          const y = pad.t + (1 - t) * (h - pad.t - pad.b)
          return (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} className="stroke-line" strokeWidth="1" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" className="fill-ink-muted" style={{ fontSize: 10 }}>
                {valuePrefix}
                {Math.round(max * t).toLocaleString('en-IN')}
              </text>
            </g>
          )
        })}
        {areaPath && <path d={areaPath} className="fill-brand-500/10" />}
        {compare.length > 1 && (
          <path
            d={linePath(compare)}
            fill="none"
            className="stroke-ink-muted"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}
        {series.length > 1 && (
          <path d={linePath(series)} fill="none" className="stroke-brand-500" strokeWidth="2" />
        )}
        {labels.map((label, i) => (
          <text
            key={`${label}-${i}`}
            x={xAt(i)}
            y={h - 8}
            textAnchor="middle"
            className="fill-ink-muted"
            style={{ fontSize: 10 }}
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}

export function DonutChart({ segments = [], size = 160, centerLabel = 'Total' }) {
  const total = segments.reduce((s, seg) => s + (Number(seg.value) || 0), 0) || 1
  const r = 56
  const c = 2 * Math.PI * r
  let offset = 0
  const colors = ['#0B6E99', '#5B6472', '#9A6700', '#B42318', '#175CD3']

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Composition chart">
        <g transform="translate(70,70)">
          {segments.map((seg, i) => {
            const len = (Number(seg.value) / total) * c
            const el = (
              <circle
                key={seg.label}
                r={r}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90)"
              />
            )
            offset += len
            return el
          })}
          <circle r={40} className="fill-surface" />
          <text textAnchor="middle" y="-4" className="fill-ink-muted" style={{ fontSize: 10 }}>
            {centerLabel}
          </text>
          <text textAnchor="middle" y="14" className="fill-ink font-semibold" style={{ fontSize: 13 }}>
            {Math.round(total).toLocaleString('en-IN')}
          </text>
        </g>
      </svg>
      <ul className="space-y-2 text-[12px]">
        {segments.map((seg, i) => (
          <li key={seg.label} className="flex items-center gap-2 text-ink-secondary">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: colors[i % colors.length] }}
            />
            <span className="text-ink">{seg.label}</span>
            <span className="ml-auto tabular-nums">
              {((Number(seg.value) / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function HorizontalBars({ items = [], valuePrefix = '₹' }) {
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 1)
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = ((Number(item.value) || 0) / max) * 100
        return (
          <div key={item.label}>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-ink-secondary">{item.label}</span>
              <span className="tabular-nums text-ink font-medium">
                {valuePrefix}
                {(Number(item.value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500/80"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ProgressMeter({ value = 0, max = 100, label, tone = 'ok' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const bar =
    tone === 'danger'
      ? 'bg-danger'
      : tone === 'warn'
        ? 'bg-warn'
        : 'bg-ok'
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1.5">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-ink-secondary">
          {pct.toFixed(0)}% · {Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })} /{' '}
          {Number(max).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
