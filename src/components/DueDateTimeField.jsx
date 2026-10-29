import { useEffect, useMemo, useState } from 'react'
import { getISTDayKey } from '../lib/datetime'

const MINUTES = ['00', '15', '30', '45']

function splitValue(value) {
  if (!value || !String(value).includes('T')) return null
  const [date, time] = String(value).split('T')
  const [rawHour, rawMinute] = (time || '').split(':')
  const hour24 = Number(rawHour)
  if (!date || Number.isNaN(hour24)) return null
  const period = hour24 >= 12 ? 'PM' : 'AM'
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12
  const minute = String(rawMinute || '00').padStart(2, '0').slice(0, 2)
  return { date, hour: String(hour12), minute, period }
}

function toLocalValue(date, hour, minute, period) {
  if (!date) return ''
  let hour24 = Number(hour)
  if (period === 'AM') {
    if (hour24 === 12) hour24 = 0
  } else if (hour24 !== 12) {
    hour24 += 12
  }
  return `${date}T${String(hour24).padStart(2, '0')}:${minute}`
}

export default function DueDateTimeField({ value, onChange, disabled = false }) {
  const today = getISTDayKey(new Date())
  const parsed = splitValue(value)
  const [date, setDate] = useState(parsed?.date || '')
  const [hour, setHour] = useState(parsed?.hour || '10')
  const [minute, setMinute] = useState(parsed?.minute || '00')
  const [period, setPeriod] = useState(parsed?.period || 'AM')

  useEffect(() => {
    const next = splitValue(value)
    if (!next) return
    setDate(next.date)
    setHour(next.hour)
    setMinute(next.minute)
    setPeriod(next.period)
  }, [value])

  const minuteOptions = useMemo(() => {
    const options = new Set(MINUTES)
    if (minute) options.add(minute)
    return [...options].sort()
  }, [minute])

  const emit = (nextDate, nextHour, nextMinute, nextPeriod) => {
    onChange(toLocalValue(nextDate, nextHour, nextMinute, nextPeriod))
  }

  const changeDate = (nextDate) => {
    if (nextDate && nextDate < today) return
    setDate(nextDate)
    emit(nextDate, hour, minute, period)
  }

  return (
    <div className="flex items-end gap-1.5 sm:gap-2 min-w-0">
      <label className="block min-w-0 flex-1 basis-0">
        <span className="block text-[11px] sm:text-[12px] font-medium text-ink-secondary mb-1">Date</span>
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => changeDate(e.target.value)}
          disabled={disabled}
          className="pf-input w-full min-w-0 max-w-full px-1.5 sm:px-3"
        />
      </label>
      <label className="block w-12 sm:w-16 shrink-0">
        <span className="block text-[11px] sm:text-[12px] font-medium text-ink-secondary mb-1">Hour</span>
        <select
          value={hour}
          onChange={(e) => {
            setHour(e.target.value)
            emit(date, e.target.value, minute, period)
          }}
          disabled={disabled}
          className="pf-input w-full min-w-0 px-1 sm:px-2"
          aria-label="Hour"
        >
          {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="block w-12 sm:w-16 shrink-0">
        <span className="block text-[11px] sm:text-[12px] font-medium text-ink-secondary mb-1">Min</span>
        <select
          value={minute}
          onChange={(e) => {
            setMinute(e.target.value)
            emit(date, hour, e.target.value, period)
          }}
          disabled={disabled}
          className="pf-input w-full min-w-0 px-1 sm:px-2"
          aria-label="Minute"
        >
          {minuteOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <div className="w-[4.5rem] sm:w-24 shrink-0">
        <span className="block text-[11px] sm:text-[12px] font-medium text-ink-secondary mb-1">AM / PM</span>
        <div className="flex h-9 w-full rounded-control border border-line overflow-hidden">
          {['AM', 'PM'].map((item) => (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => {
                setPeriod(item)
                emit(date, hour, minute, item)
              }}
              className={`flex-1 min-w-0 px-1 text-[12px] sm:text-[13px] font-semibold ${
                period === item ? 'bg-brand-500 text-white' : 'bg-surface text-ink-secondary'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
