import { requireAdminClient } from './adminSupabase'

/** FuelType enum display names — must match _admin_is_allowed_fuel_type_name */
export const ALLOWED_FUEL_TYPE_NAMES = [
  'Petrol 91',
  'Petrol XP95',
  'Petrol Speed 97',
  'Petrol Power 99',
  'Petrol XP100',
  'Petrol Premium Generic',
  'Petrol E10',
  'Petrol E20',
  'Diesel Regular',
  'Diesel Xtragreen',
  'Diesel Speed',
  'Diesel Hispeed',
  'Diesel Turbojet',
  'Diesel Premium Generic',
  'Diesel Biodiesel B5',
  'Diesel Biodiesel B7',
  'Diesel Biodiesel B100',
  'Diesel Industrial',
  'Kerosene PDS',
  'Kerosene SKO',
  'Kerosene Industrial',
  'ATF',
  'AVGAS',
  'Marine Diesel Oil',
  'Marine Gas Oil',
  'Marine Fuel HSFO',
  'Marine Fuel VLSFO',
]

export const FUEL_COUNT_MAX = 27
export const SHIFT_COUNT_MAX = 4
export const NOZZLE_COUNT_MAX = 25

export const timeToMinutes = (timeValue) => {
  if (!timeValue) return null
  const match = String(timeValue).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

export const minutesToTimeInput = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export const toTimeSql = (timeValue) => {
  if (!timeValue) return null
  const match = String(timeValue).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return `${match[1].padStart(2, '0')}:${match[2]}:00`
}

/**
 * Sort by start time, assign sequence 1..n, and set each end to one minute
 * before the next start (full-day inclusive coverage — same as SQL validator).
 * Rows without a start time are kept at the end (incomplete draft rows).
 */
export const normalizeShiftDraft = (shifts) => {
  const list = shifts || []
  const ready = list.filter((s) => timeToMinutes(s.startTime) != null)
  const pending = list.filter((s) => timeToMinutes(s.startTime) == null)

  if (ready.length === 0) {
    return list.map((s, i) => ({ ...s, sequence: i + 1, endTime: s.endTime || '' }))
  }

  const sorted = [...ready].sort(
    (a, b) =>
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
      (a.sequence || 0) - (b.sequence || 0)
  )

  const covered = sorted.map((cur, i) => {
    const next = sorted[(i + 1) % sorted.length]
    const endTime = minutesToTimeInput((timeToMinutes(next.startTime) - 1 + 1440) % 1440)
    return {
      ...cur,
      sequence: i + 1,
      endTime,
    }
  })

  const pendingNormalized = pending.map((s, i) => ({
    ...s,
    sequence: covered.length + i + 1,
    endTime: '',
  }))

  return [...covered, ...pendingNormalized]
}

/** @deprecated use normalizeShiftDraft */
export const applyShiftCoverageEnds = (shifts) => normalizeShiftDraft(shifts)

export const validateFuelDraft = (rows) => {
  if (!rows.length) return 'At least 1 fuel type is required'
  if (rows.length > FUEL_COUNT_MAX) return `A maximum of ${FUEL_COUNT_MAX} fuel types is allowed.`

  const names = []
  for (let i = 0; i < rows.length; i++) {
    const name = (rows[i].name || '').trim()
    if (!name) return `Fuel type name cannot be empty at row ${i + 1}`
    if (!ALLOWED_FUEL_TYPE_NAMES.includes(name)) {
      return `Invalid fuel type "${name}". Pick a name from the allowed list.`
    }
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      return `Duplicate fuel type "${name}"`
    }
    names.push(name)

    const rsp = Number(rows[i].rspRate)
    const ro = Number(rows[i].roRate)
    if (!Number.isFinite(rsp) || !Number.isFinite(ro)) {
      return `RSP and RO price are required for "${name}"`
    }
    if (rsp <= 0) return `RSP must be positive for "${name}"`
    if (ro < 0) return `RO price cannot be negative for "${name}"`
    if (rsp > 200 || ro > 200) return `Price maximum is ₹200/L for "${name}"`
    if (ro >= rsp) return `RO price must be less than RSP for "${name}"`
  }
  return null
}

export const validateShiftDraft = (rows) => {
  const normalized = normalizeShiftDraft(rows)
  if (!normalized.length) return 'At least one active shift is required'
  if (normalized.length > SHIFT_COUNT_MAX) return `Maximum of ${SHIFT_COUNT_MAX} shifts allowed`

  const names = []
  const starts = []
  for (const row of normalized) {
    const name = (row.name || '').trim()
    if (!name) return 'Shift name cannot be empty'
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      return 'Shift names must be unique'
    }
    names.push(name)

    const startM = timeToMinutes(row.startTime)
    const endM = timeToMinutes(row.endTime)
    if (startM == null || endM == null) return `Start and end time are required for "${name}"`
    if (starts.includes(startM)) return 'Shift start times must be unique'
    starts.push(startM)
  }

  let total = 0
  for (let i = 0; i < normalized.length; i++) {
    const cur = normalized[i]
    const next = normalized[(i + 1) % normalized.length]
    const curStart = timeToMinutes(cur.startTime)
    const curEnd = timeToMinutes(cur.endTime)
    const nextStart = timeToMinutes(next.startTime)
    const expectedEnd = (nextStart - 1 + 1440) % 1440
    if (curEnd !== expectedEnd) {
      return `Shifts must cover the full day with no gaps. "${(cur.name || '').trim()}" should end one minute before "${(next.name || '').trim()}" starts.`
    }
    total +=
      curEnd >= curStart ? curEnd - curStart + 1 : 1440 - curStart + curEnd + 1
  }
  if (total !== 1440) {
    return `Active shifts must cover exactly 24 hours (currently ${total} minutes)`
  }
  return null
}

export const validateNozzleDraft = ({ rows, meterDate, shiftId }) => {
  if (!rows.length) return 'At least one nozzle is required'
  if (rows.length > NOZZLE_COUNT_MAX) return `A maximum of ${NOZZLE_COUNT_MAX} nozzles is allowed.`
  if (!meterDate) return 'Meter readings start date is required.'
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (meterDate > todayStr) return 'Meter readings start date cannot be in the future.'
  if (!shiftId) return 'Please select a shift for the initial meter readings.'

  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].fuelTypeId) return `Fuel type is required for nozzle ${i + 1}`
    const reading = Number(rows[i].initialReading)
    if (!Number.isFinite(reading)) {
      return `initial_meter_reading is required for nozzle ${i + 1}`
    }
    if (reading < 0) return `initial_meter_reading cannot be negative for nozzle ${i + 1}`
  }
  return null
}

const rpcErrorMessage = (error) =>
  error?.message || error?.error_description || 'Request failed'

export async function adminSaveFuelTypes(pumpId, fuelDraft) {
  const client = requireAdminClient()
  const payload = fuelDraft.map((row, index) => ({
    name: row.name.trim(),
    rsp: Number(row.rspRate),
    ro_price: Number(row.roRate),
    display_order: index + 1,
  }))
  const { data, error } = await client.rpc('admin_save_fuel_types', {
    p_pump_id: pumpId,
    p_fuel_types: payload,
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data
}

export async function adminSyncPumpShifts(pumpId, shiftDraft) {
  const client = requireAdminClient()
  const normalized = normalizeShiftDraft(shiftDraft)
  const validationError = validateShiftDraft(normalized)
  if (validationError) throw new Error(validationError)

  const payload = normalized.map((row) => ({
    name: (row.name || '').trim(),
    sequence: row.sequence,
    start_time: toTimeSql(row.startTime),
    end_time: toTimeSql(row.endTime),
    is_active: true,
  }))

  const { data, error } = await client.rpc('admin_sync_pump_shifts', {
    p_pump_id: pumpId,
    p_shifts: payload,
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data
}

export async function adminSaveNozzles(pumpId, { rows, meterDate, shiftId }) {
  const client = requireAdminClient()
  const payload = rows.map((row) => ({
    fuel_type_id: row.fuelTypeId,
    initial_meter_reading: Number(row.initialReading),
  }))
  const { data, error } = await client.rpc('admin_save_nozzles', {
    p_pump_id: pumpId,
    p_nozzles: payload,
    p_meter_date: meterDate,
    p_shift_id: shiftId,
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data
}
