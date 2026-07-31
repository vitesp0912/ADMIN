import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Clock, Fuel, Gauge, RotateCcw, Save } from 'lucide-react'

const MAX_COUNT = 12

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
      <span className="text-sm font-semibold text-gray-800">{label}</span>
      <input
        type="number"
        min={0}
        max={MAX_COUNT}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(MAX_COUNT, parseInt(e.target.value, 10) || 0)))}
        className="mt-2 w-full sm:w-32 px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
    </label>
  )

  const fieldClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Complete signup</h3>
        <p className="text-sm text-gray-600 mt-1">
          Configure fuel types, shifts, and nozzles for {pumpName || 'this pump'}.
        </p>
      </div>

      {formMessage.text && (
        <div
          className={`p-3 rounded-lg border text-sm font-medium flex items-center gap-2 ${
            formMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          {formMessage.text}
        </div>
      )}

      {/* Fuel types */}
      <section className="rounded-xl border-2 border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-2">
          <Fuel className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-gray-900">1. Fuel types</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Set how many fuel types this pump sells and their RSP / RO rates.
            </p>
          </div>
        </div>
        {countInput('Number of fuel types', fuelCount, setFuelCount)}
        <div className="space-y-3">
          {fuelTypes.map((row, index) => (
            <div key={row.id} className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Fuel type {index + 1}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block sm:col-span-1">
                  <span className="text-xs font-medium text-gray-600">Name</span>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateFuel(row.id, { name: e.target.value })}
                    placeholder="e.g. Petrol"
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">RSP rate</span>
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
                  <span className="text-xs font-medium text-gray-600">RO rate</span>
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
            <p className="text-sm text-gray-500">Set a count above to add fuel type rows.</p>
          )}
        </div>
      </section>

      {/* Shifts */}
      <section className="rounded-xl border-2 border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-2">
          <Clock className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-gray-900">2. Shifts</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure shift names and start / end times. Sequence is assigned automatically.
            </p>
          </div>
        </div>
        {countInput('Number of shifts', shiftCount, setShiftCount)}
        <div className="space-y-3">
          {shifts.map((row) => (
            <div key={row.id} className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Shift {row.sequence}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Name</span>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateShift(row.id, { name: e.target.value })}
                    placeholder="e.g. Morning"
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Start time</span>
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => updateShift(row.id, { startTime: e.target.value })}
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">End time</span>
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
            <p className="text-sm text-gray-500">Set a count above to add shift rows.</p>
          )}
        </div>
      </section>

      {/* Nozzles */}
      <section className="rounded-xl border-2 border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-2">
          <Gauge className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-gray-900">3. Nozzles & initial readings</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Add nozzles with initial meter reading, business date, and shift. Fuel type and shift
              options come from the sections above.
            </p>
          </div>
        </div>
        {countInput('Number of nozzles', nozzleCount, setNozzleCount)}
        <div className="space-y-3">
          {nozzles.map((row, index) => (
            <div key={row.id} className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Nozzle {index + 1}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Nozzle name</span>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateNozzle(row.id, { name: e.target.value })}
                    placeholder="e.g. N1"
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Fuel type</span>
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
                  <span className="text-xs font-medium text-gray-600">Initial meter reading</span>
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
                  <span className="text-xs font-medium text-gray-600">Date</span>
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateNozzle(row.id, { date: e.target.value })}
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium text-gray-600">Shift</span>
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
            <p className="text-sm text-gray-500">Set a count above to add nozzle rows.</p>
          )}
        </div>
      </section>

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
        >
          <Save className="w-4 h-4" />
          Save draft
        </button>
      </div>

      {savedDraft && (
        <p className="text-xs text-gray-500">
          Last local draft saved at {new Date(savedDraft.savedAt).toLocaleString('en-IN')}.
        </p>
      )}
    </div>
  )
}
