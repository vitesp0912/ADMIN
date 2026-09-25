import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/supabase'
import { formatInr } from '../lib/format'
import { CheckCircle, Layers, Pencil, Plus, X, XCircle } from 'lucide-react'
import StatusPill from '../components/ui/StatusPill'

const PLAN_CODES = ['trial', 'monthly', 'half_yearly', 'yearly']

const emptyForm = {
  id: null,
  code: '',
  name: '',
  duration_days: '',
  duration_months: '',
  price_base_inr: '',
  gst_rate: '18',
  currency: 'INR',
  is_active: true,
  sort_order: '0',
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function toNumber(value) {
  if (value === '' || value == null) return NaN
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function previewTotals(form) {
  const base = toNumber(form.price_base_inr)
  const rate = toNumber(form.gst_rate)
  if (!Number.isFinite(base) || !Number.isFinite(rate) || base < 0 || rate < 0) return null
  const gst = roundMoney((base * rate) / 100)
  return { gst, total: roundMoney(base + gst) }
}

function validatePlan(form, plans) {
  const name = form.name.trim()
  if (!PLAN_CODES.includes(form.code)) {
    return 'Code must be trial, monthly, half_yearly, or yearly.'
  }
  const taken = plans.some((plan) => plan.code === form.code && plan.id !== form.id)
  if (taken) return `A plan with code "${form.code}" already exists.`
  if (!name) return 'Name is required.'

  const durationDays = Number(form.duration_days)
  const durationMonths = Number(form.duration_months)
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    return 'Duration days must be a whole number greater than 0.'
  }
  if (!Number.isInteger(durationMonths) || durationMonths <= 0) {
    return 'Duration months must be a whole number greater than 0.'
  }

  const price = toNumber(form.price_base_inr)
  const gstRate = toNumber(form.gst_rate)
  const sortOrder = Number(form.sort_order)
  if (!Number.isFinite(price) || price < 0) return 'Base price must be 0 or more.'
  if (!Number.isFinite(gstRate) || gstRate < 0) return 'GST rate must be 0 or more.'
  if (!form.currency.trim()) return 'Currency is required.'
  if (!Number.isInteger(sortOrder)) return 'Sort order must be a whole number.'

  return ''
}

export default function Plans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const { data, error } = await db
        .from('plans')
        .select(
          'id, code, name, duration_days, duration_months, price_base_inr, gst_rate, gst_inr, price_total_inr, currency, is_active, sort_order, created_at, updated_at'
        )
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      setPlans(data || [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to load plans' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const usedCodes = useMemo(() => new Set(plans.map((plan) => plan.code)), [plans])
  const unusedCodes = PLAN_CODES.filter((code) => !usedCodes.has(code))
  const codeOptions = form.id
    ? PLAN_CODES.filter((code) => code === form.code || !usedCodes.has(code))
    : unusedCodes

  const totals = previewTotals(form)

  const openCreate = () => {
    setForm({ ...emptyForm, code: unusedCodes[0] || '' })
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (plan) => {
    setForm({
      id: plan.id,
      code: plan.code || '',
      name: plan.name || '',
      duration_days: String(plan.duration_days ?? ''),
      duration_months: String(plan.duration_months ?? ''),
      price_base_inr: plan.price_base_inr == null ? '' : String(plan.price_base_inr),
      gst_rate: plan.gst_rate == null ? '18' : String(plan.gst_rate),
      currency: plan.currency || 'INR',
      is_active: Boolean(plan.is_active),
      sort_order: String(plan.sort_order ?? 0),
    })
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setFormError('')
  }

  const handleSave = async () => {
    const validationError = validatePlan(form, plans)
    if (validationError) {
      setFormError(validationError)
      return
    }

    const payload = {
      code: form.code,
      name: form.name.trim(),
      duration_days: Number(form.duration_days),
      duration_months: Number(form.duration_months),
      price_base_inr: roundMoney(form.price_base_inr),
      gst_rate: roundMoney(form.gst_rate),
      currency: form.currency.trim() || 'INR',
      is_active: Boolean(form.is_active),
      sort_order: Number(form.sort_order),
    }

    setSaving(true)
    setFormError('')
    try {
      if (form.id) {
        const { error } = await db
          .from('plans')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', form.id)
        if (error) throw error
        setMessage({ type: 'success', text: `Updated ${payload.name}.` })
      } else {
        const { error } = await db.from('plans').insert(payload)
        if (error) throw error
        setMessage({ type: 'success', text: `Added ${payload.name}.` })
      }
      setModalOpen(false)
      await fetchPlans()
    } catch (error) {
      setFormError(error.message || 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFormError('')
  }

  return (
    <div className="pf-page">
      {message.text && (
        <div
          className={`mb-6 p-4 rounded-card border ${
            message.type === 'success'
              ? 'bg-ok-soft text-ok border-transparent'
              : 'bg-danger-soft text-danger border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink mb-1 flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-500" />
            Plans
          </h1>
          <p className="text-ink-secondary text-[13px]">
            Add and edit subscription plans. GST and total price are calculated by the database.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={unusedCodes.length === 0}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 text-sm font-semibold"
          title={unusedCodes.length === 0 ? 'All plan codes are already used' : 'Add plan'}
        >
          <Plus className="w-4 h-4" />
          Add plan
        </button>
      </div>

      {unusedCodes.length === 0 && !loading && (
        <p className="mb-4 text-[13px] text-ink-muted">
          All allowed codes are in use: trial, monthly, half_yearly, yearly. Edit an existing plan to change it.
        </p>
      )}

      <div className="rounded-card border border-line bg-surface overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-ink-muted">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="p-10 text-center text-ink-muted">No plans yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="bg-surface-muted border-b border-line">
                <tr className="text-left text-xs font-semibold text-ink-secondary uppercase">
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Base</th>
                  <th className="px-4 py-3">GST</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{plan.name}</div>
                      <div className="text-xs font-mono text-ink-muted mt-0.5">{plan.code}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-secondary">
                      {plan.duration_months} mo · {plan.duration_days} days
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {formatInr(plan.price_base_inr, { digits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-ink-secondary">
                      {formatInr(plan.gst_inr, { digits: 2 })}
                      <span className="block text-xs text-ink-muted">{plan.gst_rate}%</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums">
                      {formatInr(plan.price_total_inr, { digits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={plan.is_active ? 'ok' : 'neutral'}>
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-ink-secondary">
                      {plan.sort_order}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(plan)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-ink-secondary border border-line rounded-lg hover:bg-surface-muted"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="w-full max-w-lg bg-surface border border-line rounded-card shadow-soft max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 className="text-[16px] font-semibold text-ink">
                {form.id ? 'Edit plan' : 'Add plan'}
              </h2>
              <button type="button" onClick={closeModal} className="p-1 text-ink-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">CODE</label>
                  <select
                    value={form.code}
                    onChange={(e) => setField('code', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface"
                  >
                    <option value="">Select code…</option>
                    {codeOptions.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">NAME</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">DURATION DAYS</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.duration_days}
                    onChange={(e) => setField('duration_days', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">DURATION MONTHS</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.duration_months}
                    onChange={(e) => setField('duration_months', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">BASE PRICE (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price_base_inr}
                    onChange={(e) => setField('price_base_inr', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">GST RATE (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gst_rate}
                    onChange={(e) => setField('gst_rate', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">CURRENCY</label>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) => setField('currency', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">SORT ORDER</label>
                  <input
                    type="number"
                    step="1"
                    value={form.sort_order}
                    onChange={(e) => setField('sort_order', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setField('is_active', e.target.checked)}
                />
                Active
              </label>

              {totals && (
                <div className="rounded-control border border-line bg-surface-muted/50 px-3 py-2.5 text-sm text-ink-secondary">
                  Preview · GST {formatInr(totals.gst, { digits: 2 })} · Total{' '}
                  <span className="font-medium text-ink">{formatInr(totals.total, { digits: 2 })}</span>
                  <span className="block text-xs text-ink-muted mt-1">
                    Saved totals come from generated columns gst_inr and price_total_inr.
                  </span>
                </div>
              )}

              {formError && <p className="text-sm text-danger">{formError}</p>}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-line">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-ink-secondary border border-line rounded-lg hover:bg-surface-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
