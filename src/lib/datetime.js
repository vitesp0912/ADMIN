const IST = 'Asia/Kolkata'

/** Calendar day key (YYYY-MM-DD) in IST for comparing dates. */
export function getISTDayKey(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Whole-day difference in IST: positive = `from` is before `to`. */
export function istDayDiff(fromInput, toInput = new Date()) {
  const fromKey = getISTDayKey(fromInput)
  const toKey = getISTDayKey(toInput)
  if (!fromKey || !toKey) return 0
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  const fromUtc = Date.UTC(fy, fm - 1, fd)
  const toUtc = Date.UTC(ty, tm - 1, td)
  return Math.round((toUtc - fromUtc) / 86400000)
}

export function formatISTDate(isoOrDate) {
  if (!isoOrDate) return '—'
  const s = String(isoOrDate)
  const date = s.length === 10 ? new Date(`${s}T12:00:00`) : new Date(s)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  })
}

export function formatISTDateTime(isoOrDate, { withSeconds = false } = {}) {
  if (!isoOrDate) return '—'
  const date = new Date(isoOrDate)
  if (Number.isNaN(date.getTime())) return '—'
  return (
    date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: true,
      timeZone: IST,
    }) + ' IST'
  )
}

/** Relative label using IST calendar days (Today / Yesterday / …). */
export function formatISTRelativeTime(timestamp) {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'

  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const dayDiff = istDayDiff(date, now)

  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  })

  const yearFmt = new Intl.DateTimeFormat('en-IN', { timeZone: IST, year: 'numeric' })
  const dateStr = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: yearFmt.format(date) !== yearFmt.format(now) ? 'numeric' : undefined,
    timeZone: IST,
  })

  if (diffMs >= 0 && diffMins < 1) return 'Just now'
  if (diffMs >= 0 && diffMins < 60) return `${diffMins} min ago`
  if (dayDiff === 0) return `Today, ${timeStr}`
  if (dayDiff === 1) return `Yesterday, ${timeStr}`
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff} days ago`

  return `${dateStr}, ${timeStr} IST`
}

/** Normalize phone for tel: links (India 10-digit → +91). */
export function phoneToTel(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return `+91${digits}`
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  return `+${digits}`
}
