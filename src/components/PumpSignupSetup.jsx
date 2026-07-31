import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Clock, Fuel, Gauge, RotateCcw, Save } from 'lucide-react'

const MAX_COUNT = 12

const SETUP_FORMS = [
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
  name: '',
  fuelTypeId: '',
  initialReading: '',
  date: '',
  shiftId: '',
})

const resizeList = (list, count, createItem) => {
  const n = Math.max(0, Math.min(MAX_COUNT, Number(count) || 0))
  if (list.length === n) return list
  if (list.length < n) {
    const next = [...list]
    while (next.length < n) next.push(createItem(next.length + 1))
    return next
  }
  return list.slice(0, n)
}

export default function PumpSignupSetup({ pumpName, onLocalSave }) {
  const [activeForm, setActiveForm] = useState('fuel')
  const [fuelCount, setFuelCount] = useState(1)
  const [fuelTypes, setFuelTypes] = useState([emptyFuelType()])
  const [shiftCount, setShiftCount] = useState(1)
  const [shifts, setShifts] = useState([emptyShift(1)])
  const [nozzleCount, setNozzleCount] = useState(1)
  const [nozzles, setNozzles] = useState([emptyNozzle()])
  const [savedDraft, setSavedDraft] = useState(null)
  const [formMessage, setFormMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    setFuelTypes((prev) => resizeList(prev, fuelCount, () => emptyFuelType()))
  }, [fuelCount])

  useEffect(() => {
    setShifts((prev) =>
      resizeList(prev, shiftCount, (seq) => emptyShift(seq)).map((s, i) => ({
        ...s,
        sequence: i + 1,
      }))
    )
  }, [shiftCount])

  useEffect(() => {
    setNozzles((prev) => resizeList(prev, nozzleCount, () => emptyNozzle()))
  }, [nozzleCount])

  const fuelOptions = useMemo(
    () => fuelTypes.filter((f) => f.name.trim()).map((f) => ({ id: f.id, name: f.name.trim() })),
    [fuelTypes]
  )

  const shiftOptions = useMemo(
    () =>
      shifts
        .filter((s) => s.name.trim() || s.startTime || s.endTime)
        .map((s) => ({
          id: s.id,
          label: s.name.trim() || `Shift ${s.sequence}`,
        })),
    [shifts]
  )

  const updateFuel = (id, patch) => {
    setFuelTypes((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const updateShift = (id, patch) => {
    setShifts((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const updateNozzle = (id, patch) => {
    setNozzles((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const handleReset = () => {
    setFuelCount(1)
    setFuelTypes([emptyFuelType()])
    setShiftCount(1)
    setShifts([emptyShift(1)])
    setNozzleCount(1)
    setNozzles([emptyNozzle()])
    setSavedDraft(null)
    setFormMessage({ type: 'success', text: 'Form reset.' })
    setTimeout(() => setFormMessage({ type: '', text: '' }), 2500)
  }

  const handleSaveDraft = () => {
    const draft = {
      pumpName,
      fuelTypes,
      shifts,
      nozzles,
      savedAt: new Date().toISOString(),
    }
    setSavedDraft(draft)
    onLocalSave?.(draft)
    setFormMessage({
      type: 'success',
      text: 'Saved locally — database wiring coming next.',
    })
    setTimeout(() => setFormMessage({ type: '', text: '' }), 4000)
  }

  const countInput = (label, value, onChange) => (
    <label className="block">
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      <input
        type="number"
        min={0}
        max={MAX_COUNT}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(MAX_COUNT, parseInt(e.target.value, 10) || 0)))}
        className="mt-2 w-full sm:w-32 px-3 py-2 border border-line-strong rounded-lg bg-surface text-ink focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      />
    </label>
  )

  const fieldClass =
    'w-full px-3 py-2 border border-line-strong rounded-lg text-sm bg-surface text-ink focus:ring-2 focus:ring-brand-500 focus:border-brand-500'

  const formButtonClass = (id) =>
    `flex flex-col items-start gap-1 rounded-lg border px-3.5 py-3 text-left transition-colors ${
      activeForm === id
        ? 'border-brand-500 bg-brand-500/10 text-ink shadow-sm'
        : 'border-line bg-surface hover:bg-surface-muted text-ink'
    }`

  return (
    <div className="space-y-6">
      {/* 1) Signup Completion */}
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
            {SETUP_FORMS.map(({ id, label, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveForm(id)}
                className={formButtonClass(id)}
                aria-pressed={activeForm === id}
              >
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                  <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                  {label}
                </span>
                <span className="text-[12px] text-ink-muted leading-snug">{description}</span>
              </button>
            ))}
          </div>

          {formMessage.text && (
            <div
              className={`p-3 rounded-lg border text-sm font-medium flex items-center gap-2 ${
                formMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              {formMessage.text}
            </div>
          )}

          {activeForm === 'fuel' && (
            <div className="space-y-4 rounded-lg border border-line bg-surface-muted/40 p-4">
              <div>
                <h3 className="text-[14px] font-semibold text-ink">Fuel Types</h3>
                <p className="text-[12px] text-ink-muted mt-0.5">
                  Set how many fuel types this pump sells and their RSP / RO rates.
                </p>
              </div>
              {countInput('Number of fuel types', fuelCount, setFuelCount)}
              <div className="space-y-3">
                {fuelTypes.map((row, index) => (
                  <div key={row.id} className="rounded-lg border border-line bg-surface p-3 space-y-3">
                    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                      Fuel type {index + 1}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">Name</span>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateFuel(row.id, { name: e.target.value })}
                          placeholder="e.g. Petrol"
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">RSP rate</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={row.rspRate}
                          onChange={(e) => updateFuel(row.id, { rspRate: e.target.value })}
                          placeholder="0.000"
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">RO rate</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={row.roRate}
                          onChange={(e) => updateFuel(row.id, { roRate: e.target.value })}
                          placeholder="0.000"
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                    </div>
                  </div>
                ))}
                {fuelCount === 0 && (
                  <p className="text-sm text-ink-muted">Set a count above to add fuel type rows.</p>
                )}
              </div>
            </div>
          )}

          {activeForm === 'shifts' && (
            <div className="space-y-4 rounded-lg border border-line bg-surface-muted/40 p-4">
              <div>
                <h3 className="text-[14px] font-semibold text-ink">Shifts configuration</h3>
                <p className="text-[12px] text-ink-muted mt-0.5">
                  Configure shift names and start / end times. Sequence is assigned automatically.
                </p>
              </div>
              {countInput('Number of shifts', shiftCount, setShiftCount)}
              <div className="space-y-3">
                {shifts.map((row) => (
                  <div key={row.id} className="rounded-lg border border-line bg-surface p-3 space-y-3">
                    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                      Shift {row.sequence}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">Name</span>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateShift(row.id, { name: e.target.value })}
                          placeholder="e.g. Morning"
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">Start time</span>
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) => updateShift(row.id, { startTime: e.target.value })}
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">End time</span>
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) => updateShift(row.id, { endTime: e.target.value })}
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                    </div>
                  </div>
                ))}
                {shiftCount === 0 && (
                  <p className="text-sm text-ink-muted">Set a count above to add shift rows.</p>
                )}
              </div>
            </div>
          )}

          {activeForm === 'nozzles' && (
            <div className="space-y-4 rounded-lg border border-line bg-surface-muted/40 p-4">
              <div>
                <h3 className="text-[14px] font-semibold text-ink">Nozzle Configuration</h3>
                <p className="text-[12px] text-ink-muted mt-0.5">
                  Add nozzles with initial meter reading, business date, and shift. Fuel type and
                  shift options come from the other forms.
                </p>
              </div>
              {countInput('Number of nozzles', nozzleCount, setNozzleCount)}
              <div className="space-y-3">
                {nozzles.map((row, index) => (
                  <div key={row.id} className="rounded-lg border border-line bg-surface p-3 space-y-3">
                    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                      Nozzle {index + 1}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">Nozzle name</span>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateNozzle(row.id, { name: e.target.value })}
                          placeholder="e.g. N1"
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">Fuel type</span>
                        <select
                          value={row.fuelTypeId}
                          onChange={(e) => updateNozzle(row.id, { fuelTypeId: e.target.value })}
                          className={`${fieldClass} mt-1`}
                        >
                          <option value="">Select fuel type</option>
                          {fuelOptions.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">
                          Initial meter reading
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.initialReading}
                          onChange={(e) => updateNozzle(row.id, { initialReading: e.target.value })}
                          placeholder="0.00"
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-ink-secondary">Date</span>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateNozzle(row.id, { date: e.target.value })}
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-xs font-medium text-ink-secondary">Shift</span>
                        <select
                          value={row.shiftId}
                          onChange={(e) => updateNozzle(row.id, { shiftId: e.target.value })}
                          className={`${fieldClass} mt-1`}
                        >
                          <option value="">Select shift</option>
                          {shiftOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
                {nozzleCount === 0 && (
                  <p className="text-sm text-ink-muted">Set a count above to add nozzle rows.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
            <button type="button" onClick={handleReset} className="pf-btn-secondary">
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button type="button" onClick={handleSaveDraft} className="pf-btn-primary">
              <Save className="w-4 h-4" />
              Save draft
            </button>
          </div>

          {savedDraft && (
            <p className="text-[12px] text-ink-muted">
              Last local draft saved at {new Date(savedDraft.savedAt).toLocaleString('en-IN')}.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
