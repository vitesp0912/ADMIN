import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock, Cylinder, Fuel, Gauge, Loader2, Plus, X } from 'lucide-react'
import { db, hasAdminServiceRole } from '../lib/supabase'
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
  {
    id: 'tanks',
    label: 'Tanks',
    description: 'Tank capacity, stock, and nozzles',
    icon: Cylinder,
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
  name: '',
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

const STOCK_DATE_FALLBACK = '2020-01-01'

const toDateInputValue = (value) => {
  if (!value) return ''
  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const sanitizeDecimalInput = (raw) => {
  const cleaned = String(raw ?? '').replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`
}

const parseDecimalField = (raw) => {
  const s = String(raw ?? '').trim()
  if (!s || s === '.') return null
  if (!/^\d+(\.\d+)?$/.test(s)) return Number.NaN
  return Number(s)
}

const nozzleDisplayName = (nozzle) => {
  const name = String(nozzle?.name || '').trim()
  if (name) return name
  return `Nozzle ${nozzle?.nozzle_number}`
}

const emptyTank = (stockStartDate) => ({
  id: crypto.randomUUID(),
  name: '',
  fuelTypeId: '',
  capacity: '',
  initialVolume: '',
  stockStartDate: stockStartDate || todayInputValue(),
  nozzleIds: [],
  isActive: true,
})

export default function PumpSignupSetup({ pumpId, pumpName }) {
  const [activeTab, setActiveTab] = useState('fuel')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fuelTypes, setFuelTypes] = useState([])
  const [shifts, setShifts] = useState([])
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [nozzlesByFuelType, setNozzlesByFuelType] = useState({})
  const [nozzleListLoading, setNozzleListLoading] = useState({})
  const [stockDateFloor, setStockDateFloor] = useState(STOCK_DATE_FALLBACK)

  const [panelMode, setPanelMode] = useState({ fuel: null, shifts: null, nozzles: null, tanks: null })
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
  const [tankDraft, setTankDraft] = useState([emptyTank()])

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
      const [fuelRes, shiftRes, nozzleRes, readingRes, tankRes, pumpRes] = await Promise.all([
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
          .select('nozzle_id, name, nozzle_number, fuel_type')
          .eq('pump_id', pumpId),
        db
          .from('nozzle_reading')
          .select('id, nozzle_id, date, shift_id, fuel_type_id, opening_reading, created_at')
          .eq('pump_id', pumpId)
          .order('date', { ascending: true })
          .order('created_at', { ascending: true }),
        db
          .from('tanks')
          .select(
            'id, name, fuel_type, capacity_liters, initial_volume_liters, current_volume_liters, is_active, stock_start_date'
          )
          .eq('pump_id', pumpId)
          .order('name', { ascending: true }),
        db.from('pumps').select('created_at').eq('id', pumpId).maybeSingle(),
      ])

      if (fuelRes.error) throw fuelRes.error
      if (shiftRes.error) throw shiftRes.error
      if (nozzleRes.error) throw nozzleRes.error
      if (readingRes.error) throw readingRes.error
      if (tankRes.error) throw tankRes.error

      const fuelMap = {}
      ;(fuelRes.data || []).forEach((f) => {
        fuelMap[f.id] = f
      })
      const shiftMap = {}
      ;(shiftRes.data || []).forEach((s) => {
        shiftMap[s.id] = s
      })
      const nozzleInfoMap = {}
      ;(nozzleRes.data || []).forEach((n) => {
        nozzleInfoMap[n.nozzle_id] = n
      })

      // Nozzle configuration view is driven only by nozzle_reading.
      // One row per nozzle (earliest reading = onboarding baseline).
      const earliestByNozzle = {}
      ;(readingRes.data || []).forEach((row) => {
        if (!earliestByNozzle[row.nozzle_id]) {
          earliestByNozzle[row.nozzle_id] = row
        }
      })

      const nextFuels = fuelRes.data || []
      // Hide leftover temp rows from older sync bug (__sync__<uuid>)
      const nextShifts = (shiftRes.data || []).filter(
        (s) => s?.name && !String(s.name).startsWith('__sync__')
      )
      setFuelTypes(nextFuels)
      setShifts(nextShifts)
      setTanks(tankRes.data || [])
      setNozzlesByFuelType({})
      setNozzles(
        Object.values(earliestByNozzle).map((reading, index) => {
          const info = nozzleInfoMap[reading.nozzle_id]
          const fuel = reading.fuel_type_id ? fuelMap[reading.fuel_type_id] : null
          const shift = reading.shift_id ? shiftMap[reading.shift_id] : null
          return {
            readingId: reading.id,
            nozzle_id: reading.nozzle_id,
            name: info?.name || null,
            nozzle_number: info?.nozzle_number ?? index + 1,
            fuelName: fuel?.name || info?.fuel_type || '—',
            initial_meter_reading: reading.opening_reading,
            readingDate: reading.date || null,
            readingShiftId: reading.shift_id || null,
            readingShiftLabel: shift ? shift.name || `Shift ${shift.sequence}` : '—',
          }
        })
      )
      setPanelMode({ fuel: null, shifts: null, nozzles: null, tanks: null })
      if (nextShifts.length > 0) {
        setMeterShiftId((prev) => prev || nextShifts[0].id)
      }

      const today = todayInputValue()
      const firstMeterDate = toDateInputValue(
        (readingRes.data || []).find((row) => row.date)?.date
      )
      const registrationDate = pumpRes.error ? '' : toDateInputValue(pumpRes.data?.created_at)
      // Business dates in this setup already start at the first meter reading.
      // Fall back to the pump registration date, then 1 Jan 2020.
      const floor = firstMeterDate || registrationDate || STOCK_DATE_FALLBACK
      setStockDateFloor(floor > today ? today : floor)
    } catch (err) {
      console.error('Pump setup fetch error:', err)
      setStockDateFloor(STOCK_DATE_FALLBACK)
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
  const canConfigureTanks = fuelTypes.length > 0 && nozzles.length > 0

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

  useEffect(() => {
    if (!canConfigureTanks && panelMode.tanks) {
      setPanelMode((prev) => ({ ...prev, tanks: null }))
    }
  }, [canConfigureTanks, panelMode.tanks])

  const setMode = (tab, mode) => {
    setPanelMode((prev) => ({ ...prev, [tab]: mode }))
    setFormMessage({ type: '', text: '' })
  }

  const defaultStockDate = () => {
    const today = todayInputValue()
    return today < stockDateFloor ? stockDateFloor : today
  }

  const openAdd = (tab) => {
    if (tab === 'nozzles' && !canConfigureNozzles) return
    if (tab === 'tanks' && !canConfigureTanks) return
    if (tab === 'fuel') {
      setFuelCountInput('1')
      setFuelDraft([emptyFuelType()])
    } else if (tab === 'shifts') {
      setShiftCountInput('1')
      setShiftDraft([emptyShift(1)])
    } else if (tab === 'tanks') {
      setTankDraft([emptyTank(defaultStockDate())])
      setNozzlesByFuelType({})
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

  const loadNozzlesForFuel = async (fuelTypeId) => {
    if (!pumpId || !fuelTypeId) return
    setNozzleListLoading((prev) => ({ ...prev, [fuelTypeId]: true }))
    try {
      const { data, error: nozzleError } = await db
        .from('nozzle_info')
        .select('nozzle_id, nozzle_number, name, tank_id')
        .eq('pump_id', pumpId)
        .eq('fuel_type_id', fuelTypeId)
        .order('nozzle_number')
      if (nozzleError) throw nozzleError
      setNozzlesByFuelType((prev) => ({ ...prev, [fuelTypeId]: data || [] }))
    } catch (err) {
      setNozzlesByFuelType((prev) => {
        const next = { ...prev }
        delete next[fuelTypeId]
        return next
      })
      showMessage('error', err.message || 'Failed to load nozzles')
    } finally {
      setNozzleListLoading((prev) => ({ ...prev, [fuelTypeId]: false }))
    }
  }

  const updateTank = (id, patch) => {
    setTankDraft((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, 'fuelTypeId') && patch.fuelTypeId !== row.fuelTypeId) {
          next.nozzleIds = []
        }
        return next
      })
    )
    if (patch.fuelTypeId) loadNozzlesForFuel(patch.fuelTypeId)
  }

  const toggleTankNozzle = (tankId, nozzleId) => {
    setTankDraft((prev) =>
      prev.map((row) => {
        if (row.id !== tankId) return row
        const selected = row.nozzleIds.includes(nozzleId)
        return {
          ...row,
          nozzleIds: selected
            ? row.nozzleIds.filter((id) => id !== nozzleId)
            : [...row.nozzleIds, nozzleId],
        }
      })
    )
  }

  const validateTankRow = (row, rows) => {
    const trimmedName = row.name.trim()
    if (!trimmedName) return 'Please enter tank name'
    const duplicateInForm = rows.some(
      (other) =>
        other.id !== row.id && other.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicateInForm) return 'A tank with this name already exists'
    if (!row.fuelTypeId) return 'Select fuel type'

    const capacity = parseDecimalField(row.capacity)
    if (capacity == null || Number.isNaN(capacity)) return 'Please enter tank capacity'
    if (capacity <= 0) return 'Capacity must be greater than 0'

    const initialVolume = parseDecimalField(row.initialVolume)
    if (initialVolume == null || Number.isNaN(initialVolume)) return 'Please enter initial volume'
    if (initialVolume < 0) return 'Initial volume cannot be negative'
    if (initialVolume > capacity) return 'Initial volume cannot exceed capacity'

    const today = todayInputValue()
    if (!row.stockStartDate || row.stockStartDate < stockDateFloor || row.stockStartDate > today) {
      return 'Stock start date must be between the earliest business date and today.'
    }

    const fuelNozzles = nozzlesByFuelType[row.fuelTypeId]
    if (!fuelNozzles) return 'Nozzles for this fuel type are still loading.'
    if (fuelNozzles.length > 0) {
      const takenElsewhere = new Set(
        rows
          .filter((other) => other.id !== row.id && other.fuelTypeId === row.fuelTypeId)
          .flatMap((other) => other.nozzleIds)
      )
      const enabledSelected = row.nozzleIds.filter((nozzleId) => {
        const nozzle = fuelNozzles.find((item) => item.nozzle_id === nozzleId)
        if (!nozzle || nozzle.tank_id) return false
        if (takenElsewhere.has(nozzleId)) return false
        return true
      })
      if (enabledSelected.length === 0) return 'Select at least one nozzle connected to this tank.'
    }

    return ''
  }

  const saveTank = async (row, nozzleCache) => {
    const trimmedName = row.name.trim()
    const { data: existing, error: existingError } = await db
      .from('tanks')
      .select('id')
      .eq('pump_id', pumpId)
      .ilike('name', trimmedName)
    if (existingError) throw existingError
    if (existing && existing.length > 0) {
      throw new Error('A tank with this name already exists')
    }

    const capacityLiters = parseDecimalField(row.capacity)
    const initialVolumeLiters = parseDecimalField(row.initialVolume)
    const { data: savedTank, error: insertError } = await db
      .from('tanks')
      .insert({
        pump_id: pumpId,
        name: trimmedName,
        fuel_type: row.fuelTypeId,
        capacity_liters: capacityLiters,
        initial_dip_cm: 0,
        initial_volume_liters: initialVolumeLiters,
        current_volume_liters: initialVolumeLiters,
        is_active: row.isActive,
        stock_start_date: row.stockStartDate,
      })
      .select()
      .single()
    if (insertError) throw insertError

    const fuelNozzles = nozzleCache[row.fuelTypeId] || []
    const selectedNozzleIds = row.nozzleIds.filter((nozzleId) => {
      const nozzle = fuelNozzles.find((item) => item.nozzle_id === nozzleId)
      return nozzle && !nozzle.tank_id
    })
    if (selectedNozzleIds.length > 0) {
      const { error: mapError } = await db
        .from('nozzle_info')
        .update({ tank_id: savedTank.id })
        .in('nozzle_id', selectedNozzleIds)
        .eq('pump_id', pumpId)
      if (mapError) {
        const linkError = new Error(mapError.message || 'Failed to link nozzles')
        linkError.tankInserted = true
        throw linkError
      }
      fuelNozzles.forEach((nozzle) => {
        if (selectedNozzleIds.includes(nozzle.nozzle_id)) nozzle.tank_id = savedTank.id
      })
    }
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
    let tanksSaved = 0
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
      } else if (tab === 'nozzles') {
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
      } else if (tab === 'tanks') {
        if (fuelTypes.length === 0) throw new Error('Add fuel types before creating tanks.')
        if (nozzles.length === 0) throw new Error('Save nozzles before creating tanks.')
        for (let i = 0; i < tankDraft.length; i += 1) {
          const validationError = validateTankRow(tankDraft[i], tankDraft)
          if (validationError) throw new Error(validationError)
        }
        const nozzleCache = Object.fromEntries(
          Object.entries(nozzlesByFuelType).map(([fuelTypeId, rows]) => [
            fuelTypeId,
            (rows || []).map((nozzle) => ({ ...nozzle })),
          ])
        )
        for (const row of tankDraft) {
          try {
            await saveTank(row, nozzleCache)
            tanksSaved += 1
          } catch (err) {
            if (err.tankInserted) tanksSaved += 1
            throw err
          }
        }
        showMessage('success', tankDraft.length === 1 ? 'Tank saved.' : 'Tanks saved.')
      }
      await loadSetup()
    } catch (err) {
      console.error('Pump setup save error:', err)
      if (tanksSaved > 0) {
        setTankDraft((prev) => prev.slice(tanksSaved))
        const { data: refreshed } = await db
          .from('tanks')
          .select(
            'id, name, fuel_type, capacity_liters, initial_volume_liters, current_volume_liters, is_active, stock_start_date'
          )
          .eq('pump_id', pumpId)
          .order('name', { ascending: true })
        if (refreshed) setTanks(refreshed)
      }
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
    if (tab === 'tanks') {
      return tankDraft.some((row) => row.fuelTypeId && nozzleListLoading[row.fuelTypeId])
    }
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-ink-secondary">Nozzle name</span>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateNozzle(row.id, { name: e.target.value })}
                  placeholder={`e.g. N${index + 1}`}
                  className={`${fieldClass} mt-1.5`}
                />
              </label>
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

  const renderTanksForm = () => (
    <div className="space-y-5 rounded-lg border border-line bg-surface-muted/40 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-ink">Add tanks</h3>
        <button
          type="button"
          onClick={() => setTankDraft((prev) => [...prev, emptyTank(defaultStockDate())])}
          className="pf-btn-secondary !h-8"
        >
          <Plus className="w-4 h-4" />
          Add another tank
        </button>
      </div>
      <div className="space-y-4">
        {tankDraft.map((row, index) => {
          const fuelNozzles = row.fuelTypeId ? nozzlesByFuelType[row.fuelTypeId] : undefined
          const loadingNozzles = Boolean(row.fuelTypeId && nozzleListLoading[row.fuelTypeId])
          const takenElsewhere = new Set(
            tankDraft
              .filter((other) => other.id !== row.id && other.fuelTypeId === row.fuelTypeId)
              .flatMap((other) => other.nozzleIds)
          )
          return (
            <div key={row.id} className="rounded-lg border border-line bg-surface p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                  Tank {index + 1}
                </p>
                {tankDraft.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTankDraft((prev) => prev.filter((item) => item.id !== row.id))}
                    className="text-[12px] text-ink-muted hover:text-ink"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-ink-secondary">Tank name</span>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateTank(row.id, { name: e.target.value })}
                    className={`${fieldClass} mt-1.5`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-secondary">Fuel type</span>
                  <select
                    value={row.fuelTypeId}
                    onChange={(e) => updateTank(row.id, { fuelTypeId: e.target.value })}
                    className={`${fieldClass} mt-1.5`}
                  >
                    <option value="">Select fuel type</option>
                    {fuelTypes.map((fuel) => (
                      <option key={fuel.id} value={fuel.id}>
                        {fuel.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-secondary">Capacity (liters)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.capacity}
                    onChange={(e) => updateTank(row.id, { capacity: sanitizeDecimalInput(e.target.value) })}
                    className={`${fieldClass} mt-1.5`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-secondary">Initial volume (liters)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.initialVolume}
                    onChange={(e) =>
                      updateTank(row.id, { initialVolume: sanitizeDecimalInput(e.target.value) })
                    }
                    className={`${fieldClass} mt-1.5`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-secondary">Stock start date</span>
                  <input
                    type="date"
                    value={row.stockStartDate}
                    min={stockDateFloor}
                    max={todayInputValue()}
                    onChange={(e) => updateTank(row.id, { stockStartDate: e.target.value })}
                    className={`${fieldClass} mt-1.5`}
                  />
                </label>
                <div className="flex items-end">
                  <label className="flex items-center justify-between gap-3 w-full rounded-lg border border-line px-3.5 py-2.5">
                    <span className="text-xs font-medium text-ink-secondary">Active</span>
                    <button
                      type="button"
                      onClick={() => updateTank(row.id, { isActive: !row.isActive })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        row.isActive ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      aria-pressed={row.isActive}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          row.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-secondary">Connected nozzles</p>
                {!row.fuelTypeId ? (
                  <p className="mt-2 text-[12px] text-ink-muted">Select a fuel type to load nozzles.</p>
                ) : loadingNozzles ? (
                  <p className="mt-2 text-[12px] text-ink-muted">Loading nozzles…</p>
                ) : !fuelNozzles ? (
                  <p className="mt-2 text-[12px] text-ink-muted">Nozzles could not be loaded.</p>
                ) : fuelNozzles.length === 0 ? (
                  <p className="mt-2 text-[12px] text-ink-secondary">No nozzles available for this fuel type.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {fuelNozzles.map((nozzle) => {
                      const linkedElsewhere = Boolean(nozzle.tank_id) || takenElsewhere.has(nozzle.nozzle_id)
                      const checked = row.nozzleIds.includes(nozzle.nozzle_id)
                      return (
                        <label
                          key={nozzle.nozzle_id}
                          className={`flex items-start gap-2 rounded-lg border border-line px-3 py-2 ${
                            linkedElsewhere ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked && !linkedElsewhere}
                            disabled={linkedElsewhere}
                            onChange={() => {
                              if (!linkedElsewhere) toggleTankNozzle(row.id, nozzle.nozzle_id)
                            }}
                          />
                          <span>
                            <span className="block text-[13px] font-medium text-ink">
                              {nozzleDisplayName(nozzle)}
                            </span>
                            {linkedElsewhere && (
                              <span className="block text-[12px] text-ink-muted">
                                Already connected to another tank
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {formFooter('tanks')}
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
            title="No nozzle readings yet"
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
                <th className="px-3 py-2.5 text-right font-medium">Opening reading</th>
                <th className="px-3 py-2.5 text-left font-medium">Date</th>
                <th className="px-3 py-2.5 text-left font-medium">Shift</th>
              </tr>
            </thead>
            <tbody>
              {nozzles.map((row) => (
                <tr key={row.readingId || row.nozzle_id} className="border-t border-line">
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

  const fuelTypeName = (fuelTypeId) =>
    fuelTypes.find((fuel) => fuel.id === fuelTypeId)?.name || '—'

  const tanksLockMessage =
    fuelTypes.length === 0
      ? 'Add fuel types before creating tanks.'
      : 'Save nozzles before creating tanks.'

  const renderTanksView = () => {
    if (!canConfigureTanks) {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{tanksLockMessage}</p>
          </div>
          <EmptyState
            title="Tanks are locked"
            description="Add fuel types and save nozzles before creating tanks."
          />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button type="button" onClick={() => openAdd('tanks')} className="pf-btn-primary">
            <Plus className="w-4 h-4" />
            Add tank
          </button>
        </div>
        {tanks.length === 0 ? (
          <EmptyState
            title="No tanks yet"
            description={`Add tanks for ${pumpName || 'this pump'}.`}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full text-[13px]">
              <thead className="bg-surface-muted text-ink-secondary">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Name</th>
                  <th className="px-3 py-2.5 text-left font-medium">Fuel type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Capacity (L)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Initial volume (L)</th>
                  <th className="px-3 py-2.5 text-left font-medium">Stock start</th>
                  <th className="px-3 py-2.5 text-left font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {tanks.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-3 py-2.5 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-2.5 text-ink">{fuelTypeName(row.fuel_type)}</td>
                    <td className="px-3 py-2.5 text-right text-ink">{formatLiters(row.capacity_liters)}</td>
                    <td className="px-3 py-2.5 text-right text-ink">
                      {formatLiters(row.initial_volume_liters)}
                    </td>
                    <td className="px-3 py-2.5 text-ink">{formatDate(row.stock_start_date)}</td>
                    <td className="px-3 py-2.5 text-ink">{row.is_active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    if (activeTab === 'tanks') {
      if (panelMode.tanks && canConfigureTanks) return renderTanksForm()
      return renderTanksView()
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
              Configure fuel types, shifts, nozzles, and tanks for {pumpName || 'this pump'}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {SETUP_TABS.map(({ id, label, description, icon: Icon }) => {
              const tanksLocked = id === 'tanks' && !canConfigureTanks
              return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (tanksLocked) return
                  setActiveTab(id)
                }}
                disabled={tanksLocked}
                title={
                  tanksLocked
                    ? fuelTypes.length === 0
                      ? 'Add fuel types before creating tanks.'
                      : 'Save nozzles before creating tanks.'
                    : undefined
                }
                className={`${tabButtonClass(id)} ${tanksLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-pressed={activeTab === id}
              >
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                  <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                  {label}
                </span>
                <span className="text-[12px] text-ink-muted leading-snug">{description}</span>
              </button>
              )
            })}
          </div>

          {renderPanel()}
        </div>
      </section>
    </div>
  )
}
