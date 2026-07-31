export function formatInr(value, { digits = 0 } = {}) {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return '—'
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function formatCount(value) {
  const n = Number(value) || 0
  return n.toLocaleString('en-IN')
}

export function pctChange(current, previous) {
  const c = parseFloat(current) || 0
  const p = parseFloat(previous) || 0
  if (p === 0) return c === 0 ? 0 : 100
  return ((c - p) / Math.abs(p)) * 100
}

export function startOfLocalDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfLocalDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function daysAgo(n, from = new Date()) {
  const d = startOfLocalDay(from)
  d.setDate(d.getDate() - n)
  return d
}

/** Inclusive period helpers for client-side filters */
export function getPeriodRange(period) {
  const now = new Date()
  const todayStart = startOfLocalDay(now)
  const todayEnd = endOfLocalDay(now)

  switch (period) {
    case 'today':
      return { start: todayStart, end: todayEnd, label: 'Today' }
    case 'yesterday': {
      const y = daysAgo(1)
      return { start: y, end: endOfLocalDay(y), label: 'Yesterday' }
    }
    case '7d':
      return { start: daysAgo(6), end: todayEnd, label: 'Last 7 days' }
    case '30d':
      return { start: daysAgo(29), end: todayEnd, label: 'Last 30 days' }
    default:
      return { start: daysAgo(29), end: todayEnd, label: 'Last 30 days' }
  }
}

export function isInRange(isoOrDate, start, end) {
  if (!isoOrDate) return false
  const t = new Date(isoOrDate).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

export function bucketByDay(rows, dateField, valueField, days = 7) {
  const buckets = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = daysAgo(i)
    const key = day.toISOString().slice(0, 10)
    buckets.push({ key, label: day.toLocaleDateString('en-IN', { weekday: 'short' }), value: 0 })
  }
  const index = Object.fromEntries(buckets.map((b, i) => [b.key, i]))
  for (const row of rows || []) {
    const d = row[dateField] ? new Date(row[dateField]) : null
    if (!d || Number.isNaN(d.getTime())) continue
    const key = startOfLocalDay(d).toISOString().slice(0, 10)
    if (index[key] === undefined) continue
    buckets[index[key]].value += parseFloat(row[valueField]) || 0
  }
  return buckets
}
