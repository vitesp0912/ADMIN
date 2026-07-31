import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock, Fuel, Gauge, Loader2, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hasAdminServiceRole, requireAdminClient } from '../lib/adminSupabase'
import {
  ALLOWED_FUEL_TYPE_NAMES,
  FUEL_COUNT_MAX,
  NOZZLE_COUNT_MAX,
  SHIFT_COUNT_MAX,
  adminSaveFuelTypes,
  adminSaveNozzles,
  adminSyncPumpShifts,
  normalizeShiftDraft,
  validateFuelDraft,
  validateNozzleDraft,
  validateShiftDraft,
} from '../lib/adminOnboarding'
import EmptyState from './ui/EmptyState'

const SETUP_TABS = [
  {
    id: 'fuel',
    label: 'Fuel Types',
    description: 'Fuel types and RSP / RO rates',
    icon: Fuel,
  },
  {
    id: 'shifts',
    label: 'Shifts configuration',
    description: 'Shift names and start / end times',
    icon: Clock,
  },
  {
    id: 'nozzles',
    label: 'Nozzle Configuration',
    description: 'Nozzles and initial meter readings',
    icon: Gauge,
  },
]

const emptyFuelType = () => ({
  id: crypto.randomUUID(),
  name: '',
  rspRate: '',
  roRate: '',
})

const emptyShift = (sequence = 1) => ({
  id: crypto.randomUUID(),
  name: '',
  sequence,
  startTime: '',
  endTime: '',
})

const emptyNozzle = () => ({
  id: crypto.randomUUID(),
  fuelTypeId: '',
  initialReading: '0',
})

const resizeList = (list, count, createItem) => {
  const n = Math.max(0, Number(count) || 0)
  if (list.length === n) return list
  if (list.length < n) {
    const next = [...list]
    while (next.length < n) next.push(createItem(next.length + 1))
    return next
  }
  return list.slice(0, n)
}

const formatMoney = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatLiters = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatShiftTime = (timeValue) => {
  if (!timeValue) return '—'
  const raw = String(timeValue)
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return raw
  let hours = parseInt(match[1], 10)
  const minutes = match[2]
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${hours}:${minutes} ${ampm}`
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN')
  } catch {
    return String(value)
  }
}

const todayInputValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PumpSignupSetup({ pumpId, pumpName }) {
  const [activeTab, setActiveTab] = useState('fuel')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fuelTypes, setFuelTypes] = useState([])
  const [shifts, setShifts] = useState([])
  const [nozzles, setNozzles] = useState([])

  const [panelMode, setPanelMode] = useState({ fuel: null, shifts: null, nozzles: null })
  const [saving, setSaving] = useState(false)
  const [formMessage, setFormMessage] = useState({ type: '', text: '' })

  const [fuelCountInput, setFuelCountInput] = useState('1')
  const [fuelDraft, setFuelDraft] = useState([emptyFuelType()])
  const [shiftCountInput, setShiftCountInput] = useState('1')
  const [shiftDraft, setShiftDraft] = useState([emptyShift(1)])
  const [nozzleCountInput, setNozzleCountInput] = useState('1')
  const [nozzleDraft, setNozzleDraft] = useState([emptyNozzle()])
  const [meterDate, setMeterDate] = useState(todayInputValue())
  const [meterShiftId, setMeterShiftId] = useState('')

  const parseCountInput = (raw, max) => {
    if (raw === '' || raw == null) return null
    const n = parseInt(String(raw), 10)
    if (!Number.isFinite(n) || n < 1) return null
    return Math.min(n, max)
  }

  const fuelCount = parseCountInput(fuelCountInput, FUEL_COUNT_MAX)
  const shiftCount = parseCountInput(shiftCountInput, SHIFT_COUNT_MAX)
  const nozzleCount = parseCountInput(nozzleCountInput, NOZZLE_COUNT_MAX)

  const loadSetup = useCallback(async () => {
    if (!pumpId) return
    setLoading(true)
    setError('')
    try {
      // Prefer service-role client so pending-pump rows are visible after admin writes
      const db = hasAdminServiceRole ? requireAdminClient() : supabase

      const [fuelRes, shiftRes, nozzleRes, readingRes] = await Promise.all([
        db
          .from('fuel_types')
          .select('id, name, rsp, ro_price, is_active, display_order')
          .eq('pump_id', pumpId)
          .order('display_order', { ascending: true }),
        db
          .from('shifts')
          .select('id, name, sequence, start_time, end_time, is_active')
          .eq('pump_id', pumpId)
          .eq('is_active', true)
          .order('sequence', { ascending: true }),
        db
          .from('nozzle_info')
          .select(
            'pump_id, nozzle_id, name, nozzle_number, fuel_type, fuel_type_id, initial_meter_reading, is_active'
          )
          .eq('pump_id', pumpId)
          .eq('is_active', true)
          .order('nozzle_number', { ascending: true }),
        db
          .from('nozzle_reading')
          .select('nozzle_id, date, shift_id, opening_reading, created_at')
          .eq('pump_id', pumpId)
          .order('date', { ascending: true })
          .order('created_at', { ascending: true }),
      ])

      if (fuelRes.error) throw fuelRes.error
      if (shiftRes.error) throw shiftRes.error
      if (nozzleRes.error) throw nozzleRes.error
      if (readingRes.error) throw readingRes.error

      const activeNozzles = nozzleRes.data || []
      const activeNozzleIds = new Set(activeNozzles.map((n) => n.nozzle_id))

      // Only attach readings that still belong to an active nozzle_info row.
      // Saving nozzles writes BOTH nozzle_info and a baseline nozzle_reading;
      // deleting one table alone can leave the other looking "stuck".
      const earliestReadingByNozzle = {}
      ;(readingRes.data || []).forEach((row) => {
        if (!activeNozzleIds.has(row.nozzle_id)) return
        if (!earliestReadingByNozzle[row.nozzle_id]) {
          earliestReadingByNozzle[row.nozzle_id] = row
        }
      })

      const fuelMap = {}
      ;(fuelRes.data || []).forEach((f) => {
        fuelMap[f.id] = f
      })
      const shiftMap = {}
      ;(shiftRes.data || []).forEach((s) => {
        shiftMap[s.id] = s
      })

      const nextFuels = fuelRes.data || []
      // Hide leftover temp rows from older sync bug (__sync__<uuid>)
      const nextShifts = (shiftRes.data || []).filter(
        (s) => s?.name && !String(s.name).startsWith('__sync__')
      )
      setFuelTypes(nextFuels)
      setShifts(nextShifts)
      setNozzles(
        activeNozzles.map((n) => {
          const reading = earliestReadingByNozzle[n.nozzle_id]
          const fuel = n.fuel_type_id ? fuelMap[n.fuel_type_id] : null
          const shift = reading?.shift_id ? shiftMap[reading.shift_id] : null
          return {
            ...n,
            fuelName: fuel?.name || n.fuel_type || '—',
            readingDate: reading?.date || null,
            readingShiftId: reading?.shift_id || null,
            readingShiftLabel: shift ? shift.name || `Shift ${shift.sequence}` : '—',
          }
        })
      )
      setPanelMode({ fuel: null, shifts: null, nozzles: null })
      if (nextShifts.length > 0) {
        setMeterShiftId((prev) => prev || nextShifts[0].id)
      }
    } catch (err) {
      console.error('Pump setup fetch error:', err)
      setError(err.message || 'Failed to load setup data')
    } finally {
      setLoading(false)
    }
  }, [pumpId])

  useEffect(() => {
    loadSetup()
  }, [loadSetup])

  useEffect(() => {
    if (fuelCount == null) return
    setFuelDraft((prev) => resizeList(prev, fuelCount, () => emptyFuelType()))
  }, [fuelCount])

  useEffect(() => {
    if (shiftCount == null) return
    setShiftDraft((prev) =>
      normalizeShiftDraft(
        resizeList(prev, shiftCount, (seq) => emptyShift(seq)).map((s, i) => ({
          ...s,
          sequence: i + 1,
        }))
      )
    )
  }, [shiftCount])

  useEffect(() => {
    if (nozzleCount == null) return
    setNozzleDraft((prev) => resizeList(prev, nozzleCount, () => emptyNozzle()))
  }, [nozzleCount])

  const canConfigureNozzles = fuelTypes.length > 0 && shifts.length > 0

  const nozzlePrerequisiteWarning = (() => {
    const missing = []
    if (fuelTypes.length === 0) missing.push('fuel types')
    if (shifts.length === 0) missing.push('shifts')
    if (missing.length === 0) return ''
    return `Configure ${missing.join(' and ')} first before adding nozzles.`
  })()

  useEffect(() => {
    if (!canConfigureNozzles && panelMode.nozzles) {
      setPanelMode((prev) => ({ ...prev, nozzles: null }))
    }
  }, [canConfigureNozzles, panelMode.nozzles])

  const setMode = (tab, mode) => {
    setPanelMode((prev) => ({ ...prev, [tab]: mode }))
    setFormMessage({ type: '', text: '' })
  }

  const openAdd = (tab) => {
    if (tab === 'nozzles' && !canConfigureNozzles) return
    if (tab === 'fuel') {
      setFuelCountInput('1')
      setFuelDraft([emptyFuelType()])
    } else if (tab === 'shifts') {
      setShiftCountInput('1')
      setShiftDraft([emptyShift(1)])
    } else {
      setNozzleCountInput('1')
      setNozzleDraft([emptyNozzle()])
      setMeterDate(todayInputValue())
      setMeterShiftId(shifts[0]?.id || '')
    }
    setMode(tab, 'add')
  }

  const closeForm = (tab) => setMode(tab, null)

  const updateFuel = (id, patch) => {
    setFuelDraft((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const updateShift = (id, patch) => {
    setShiftDraft((prev) => {
      const next = prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
      // Re-sequence + recompute ends when start times change
      return Object.prototype.hasOwnProperty.call(patch, 'startTime')
        ? normalizeShiftDraft(next)
        : next
    })
  }

  const updateNozzle = (id, patch) => {
    setNozzleDraft((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const showMessage = (type, text) => {
    setFormMessage({ type, text })
  }

  const handleSave = async (tab) => {
    if (!pumpId) return
    if (saveDisabledForTab(tab)) return
    if (!hasAdminServiceRole) {
      showMessage(
        'error',
        'Set VITE_SUPABASE_SERVICE_ROLE_KEY in .env — admin onboarding RPCs are service_role only.'
      )
      return
    }

    setSaving(true)
    setFormMessage({ type: '', text: '' })
    try {
      if (tab === 'fuel') {
        const validationError = validateFuelDraft(fuelDraft)
        if (validationError) throw new Error(validationError)
        await adminSaveFuelTypes(pumpId, fuelDraft)
        showMessage('success', 'Fuel types saved.')
      } else if (tab === 'shifts') {
        const normalized = normalizeShiftDraft(shiftDraft)
        setShiftDraft(normalized)
        const validationError = validateShiftDraft(normalized)
        if (validationError) throw new Error(validationError)
        await adminSyncPumpShifts(pumpId, normalized)
        showMessage('success', 'Shifts saved.')
      } else {
        const validationError = validateNozzleDraft({
          rows: nozzleDraft,
          meterDate,
          shiftId: meterShiftId,
        })
        if (validationError) throw new Error(validationError)
        await adminSaveNozzles(pumpId, {
          rows: nozzleDraft,
          meterDate,
          shiftId: meterShiftId,
        })
        showMessage('success', 'Nozzles saved.')
      }
      await loadSetup()
    } catch (err) {
      console.error('Pump setup save error:', err)
      showMessage('error', err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCountInputChange = (raw, max, onChange) => {
    const digits = String(raw).replace(/\D/g, '')
    if (digits === '') {
      onChange('')
      return
    }
    const n = parseInt(digits, 10)
    if (!Number.isFinite(n)) return
    if (n > max) {
      onChange(String(max))
      return
    }
    onChange(digits)
  }

  const countInput = (label, value, onChange, max) => (
    <label className="block">
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => handleCountInputChange(e.target.value, max, onChange)}
        className="mt-2 w-full sm:w-36 px-3.5 py-2.5 border border-line-strong rounded-lg bg-surface text-ink focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      />
      <span className="block text-[11px] text-ink-muted mt-1.5">Max {max}</span>
    </label>
  )

  const saveDisabledForTab = (tab) => {
    if (saving) return true
    if (tab === 'fuel') return fuelCount == null
    if (tab === 'shifts') return shiftCount == null
    if (tab === 'nozzles') return nozzleCount == null
    return false
  }

  const fieldClass =
    'w-full px-3.5 py-2.5 border border-line-strong rounded-lg text-sm bg-surface text-ink focus:ring-2 focus:ring-brand-500 focus:border-brand-500'

  const tabButtonClass = (id) =>
    `flex flex-col items-start gap-1 rounded-lg border px-3.5 py-3 text-left transition-colors ${
      activeTab === id
        ? 'border-brand-500 bg-brand-500/10 text-ink shadow-sm'
        : 'border-line bg-surface hover:bg-surface-muted text-ink'
    }`

  const messageBanner = formMessage.text && (
    <div
      className={`p-3 rounded-lg border text-sm font-medium ${
        formMessage.type === 'success'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
          : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
      }`}
    >
      {formMessage.text}
    </div>
  )

  const formFooter = (tab) => {
    const saveDisabled = saveDisabledForTab(tab)
    return (
      <div className="space-y-4 pt-2">
        {messageBanner}
        {!hasAdminServiceRole && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Add <code className="font-mono">VITE_SUPABASE_SERVICE_ROLE_KEY</code> to your local{' '}
              <code className="font-mono">.env</code> to enable saves (admin RPCs are service_role
              only).
            </p>
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-3">
          <button
            type="button"
            onClick={() => closeForm(tab)}
            disabled={saving}
            className="pf-btn-secondary"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave(tab)}
            disabled={saveDisabled}
            className={`pf-btn-primary ${saveDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  const renderFuelForm = () => (
    <div className="space-y-5 rounded-lg border border-line bg-surface-muted/40 p-5 sm:p-6">
      <div>
        <h3 className="text-[14px] font-semibold text-ink">Add fuel types</h3>
      </div>
      {countInput('Number of fuel types', fuelCountInput, setFuelCountInput, FUEL_COUNT_MAX)}
      <div className="space-y-4">
        {fuelDraft.map((row, index) => (
          <div key={row.id} className="rounded-lg border border-line bg-surface p-4 space-y-3.5">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
              Fuel type {index + 1}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block sm:col-span-1">
                <span className="text-xs font-medium text-ink-secondary">Name</span>
                <select
                  value={row.name}
                  onChange={(e) => updateFuel(row.id, { name: e.target.value })}
                  className={`${fieldClass} mt-1.5`}
                >
                  <option value="">Select fuel type</option>
                  {ALLOWED_FUEL_TYPE_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-secondary">RSP</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="200"
                  value={row.rspRate}
                  onChange={(e) => updateFuel(row.id, { rspRate: e.target.value })}
                  placeholder="0.00"
                  className={`${fieldClass} mt-1.5`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-secondary">RO price</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="200"
                  value={row.roRate}
                  onChange={(e) => updateFuel(row.id, { roRate: e.target.value })}
                  placeholder="0.00"
                  className={`${fieldClass} mt-1.5`}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      {formFooter('fuel')}
    </div>
  )

  const renderShiftsForm = () => (
    <div className="space-y-5 rounded-lg border border-line bg-surface-muted/40 p-5 sm:p-6">
      <div>
        <h3 className="text-[14px] font-semibold text-ink">Add shifts</h3>
      </div>
      {countInput('Number of shifts', shiftCountInput, setShiftCountInput, SHIFT_COUNT_MAX)}
      <div className="space-y-4">
        {shiftDraft.map((row) => (
          <div key={row.id} className="rounded-lg border border-line bg-surface p-4 space-y-3.5">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
              Shift {row.sequence}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-ink-secondary">Name</span>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateShift(row.id, { name: e.target.value })}
                  placeholder="e.g. Morning"
                  className={`${fieldClass} mt-1.5`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-secondary">Start time</span>
                <input
                  type="time"
                  value={row.startTime}
                  onChange={(e) => updateShift(row.id, { startTime: e.target.value })}
                  className={`${fieldClass} mt-1.5`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-secondary">
                  End time <span className="text-ink-muted font-normal">(auto)</span>
                </span>
                <input
                  type="time"
                  value={row.endTime}
                  readOnly
                  className={`${fieldClass} mt-1.5 bg-surface-muted cursor-default`}
                  title="Filled automatically so shifts cover 24 hours"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      {formFooter('shifts')}
    </div>
  )

  const renderNozzlesForm = () => (
    <div className="space-y-5 rounded-lg border border-line bg-surface-muted/40 p-5 sm:p-6">
      <div>
        <h3 className="text-[14px] font-semibold text-ink">Add nozzles</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-medium text-ink-secondary">Meter start date</span>
          <input
            type="date"
            value={meterDate}
            max={todayInputValue()}
            onChange={(e) => setMeterDate(e.target.value)}
            className={`${fieldClass} mt-1.5`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink-secondary">Shift</span>
          <select
            value={meterShiftId}
            onChange={(e) => setMeterShiftId(e.target.value)}
            className={`${fieldClass} mt-1.5`}
          >
            <option value="">Select shift</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || `Shift ${s.sequence}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {countInput('Number of nozzles', nozzleCountInput, setNozzleCountInput, NOZZLE_COUNT_MAX)}
      <div className="space-y-4">
        {nozzleDraft.map((row, index) => (
          <div key={row.id} className="rounded-lg border border-line bg-surface p-4 space-y-3.5">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
              Nozzle {index + 1}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-ink-secondary">Fuel type</span>
                <select
                  value={row.fuelTypeId}
                  onChange={(e) => updateNozzle(row.id, { fuelTypeId: e.target.value })}
                  className={`${fieldClass} mt-1.5`}
                >
                  <option value="">Select fuel type</option>
                  {fuelTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-secondary">Initial meter reading</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.initialReading}
                  onChange={(e) => updateNozzle(row.id, { initialReading: e.target.value })}
                  placeholder="0.00"
                  className={`${fieldClass} mt-1.5`}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      {formFooter('nozzles')}
    </div>
  )

  const renderFuelView = () => {
    if (fuelTypes.length === 0) {
      return (
        <EmptyState
          title="No fuel types yet"
          description={`Add fuel types for ${pumpName || 'this pump'} to complete signup.`}
          action={
            <button type="button" onClick={() => openAdd('fuel')} className="pf-btn-primary">
              <Plus className="w-4 h-4" />
              Add fuel types
            </button>
          }
        />
      )
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full text-[13px]">
          <thead className="bg-surface-muted text-ink-secondary">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Name</th>
              <th className="px-3 py-2.5 text-right font-medium">RSP</th>
              <th className="px-3 py-2.5 text-right font-medium">RO price</th>
            </tr>
          </thead>
          <tbody>
            {fuelTypes.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2.5 font-medium text-ink">{row.name || '—'}</td>
                <td className="px-3 py-2.5 text-right text-ink">{formatMoney(row.rsp)}</td>
                <td className="px-3 py-2.5 text-right text-ink">{formatMoney(row.ro_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderShiftsView = () => {
    if (shifts.length === 0) {
      return (
        <EmptyState
          title="No shifts yet"
          description={`Configure shifts for ${pumpName || 'this pump'} to complete signup.`}
          action={
            <button type="button" onClick={() => openAdd('shifts')} className="pf-btn-primary">
              <Plus className="w-4 h-4" />
              Add shifts
            </button>
          }
        />
      )
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full text-[13px]">
          <thead className="bg-surface-muted text-ink-secondary">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Sequence</th>
              <th className="px-3 py-2.5 text-left font-medium">Name</th>
              <th className="px-3 py-2.5 text-left font-medium">Start</th>
              <th className="px-3 py-2.5 text-left font-medium">End</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2.5 text-ink">{row.sequence}</td>
                <td className="px-3 py-2.5 font-medium text-ink">{row.name || '—'}</td>
                <td className="px-3 py-2.5 text-ink">{formatShiftTime(row.start_time)}</td>
                <td className="px-3 py-2.5 text-ink">{formatShiftTime(row.end_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const nozzleBlockedNotice = !canConfigureNozzles && (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <p>{nozzlePrerequisiteWarning}</p>
    </div>
  )

  const renderNozzlesView = () => {
    if (nozzles.length === 0) {
      return (
        <div className="space-y-3">
          {nozzleBlockedNotice}
          <EmptyState
            title="No nozzles yet"
            description={
              canConfigureNozzles
                ? `Add nozzle configuration for ${pumpName || 'this pump'} to complete signup.`
                : 'Nozzle configuration is locked until fuel types and shifts are set up.'
            }
            action={
              <button
                type="button"
                onClick={() => openAdd('nozzles')}
                disabled={!canConfigureNozzles}
                className={`pf-btn-primary ${!canConfigureNozzles ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={canConfigureNozzles ? undefined : nozzlePrerequisiteWarning}
              >
                <Plus className="w-4 h-4" />
                Add nozzles
              </button>
            }
          />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full text-[13px]">
            <thead className="bg-surface-muted text-ink-secondary">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Nozzle</th>
                <th className="px-3 py-2.5 text-left font-medium">Fuel type</th>
                <th className="px-3 py-2.5 text-right font-medium">Initial reading</th>
                <th className="px-3 py-2.5 text-left font-medium">Date</th>
                <th className="px-3 py-2.5 text-left font-medium">Shift</th>
              </tr>
            </thead>
            <tbody>
              {nozzles.map((row) => (
                <tr key={row.nozzle_id} className="border-t border-line">
                  <td className="px-3 py-2.5 font-medium text-ink">
                    {row.name ||
                      (row.nozzle_number != null ? `N${row.nozzle_number}` : row.nozzle_id?.slice(0, 8))}
                  </td>
                  <td className="px-3 py-2.5 text-ink">{row.fuelName}</td>
                  <td className="px-3 py-2.5 text-right text-ink">
                    {formatLiters(row.initial_meter_reading)}
                  </td>
                  <td className="px-3 py-2.5 text-ink">{formatDate(row.readingDate)}</td>
                  <td className="px-3 py-2.5 text-ink">{row.readingShiftLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderPanel = () => {
    if (loading) {
      return (
        <div className="rounded-lg border border-line bg-surface-muted/40 px-4 py-10 text-center text-[13px] text-ink-muted">
          Loading setup data…
        </div>
      )
    }

    if (error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-[13px] text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )
    }

    if (activeTab === 'fuel') {
      if (panelMode.fuel) return renderFuelForm()
      return renderFuelView()
    }
    if (activeTab === 'shifts') {
      if (panelMode.shifts) return renderShiftsForm()
      return renderShiftsView()
    }
    if (panelMode.nozzles && canConfigureNozzles) return renderNozzlesForm()
    return renderNozzlesView()
  }

  return (
    <div className="space-y-6">
      <section className="pf-card overflow-hidden">
        <div className="pf-card-header !py-3.5">
          <div>
            <h2 className="pf-section-title">Signup Completion</h2>
            <p className="pf-meta mt-0.5">
              Configure fuel types, shifts, and nozzles for {pumpName || 'this pump'}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {SETUP_TABS.map(({ id, label, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={tabButtonClass(id)}
                aria-pressed={activeTab === id}
              >
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                  <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                  {label}
                </span>
                <span className="text-[12px] text-ink-muted leading-snug">{description}</span>
              </button>
            ))}
          </div>

          {renderPanel()}
        </div>
      </section>
    </div>
  )
}
