import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Search, Filter, Users, Phone, TrendingUp, X } from 'lucide-react'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted', 'lost', 'on_hold']
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent']
const SOURCE_OPTIONS = ['manual', 'walk_in', 'call', 'whatsapp', 'website', 'referral', 'campaign', 'other']

const emptyForm = {
  id: null,
  full_name: '',
  phone: '',
  alternate_phone: '',
  email: '',
  company_name: '',
  status: '',
  priority: '',
  source: '',
  city: '',
  state: '',
  pincode: '',
  address: '',
  notes: '',
}

const toTitleCase = (v) =>
  String(v || '')
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

export default function Leads() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [inlineSavingId, setInlineSavingId] = useState('')

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const { data: leadRows, error: leadErr } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      if (leadErr) throw leadErr
      setLeads(leadRows || [])
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load leads' })
    } finally {
      setLoading(false)
    }
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = search.toLowerCase()
      const matchSearch =
        lead.full_name?.toLowerCase().includes(q) ||
        lead.phone?.includes(search) ||
        lead.company_name?.toLowerCase().includes(q) ||
        lead.city?.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || lead.status === statusFilter
      const matchPriority = priorityFilter === 'all' || lead.priority === priorityFilter
      return matchSearch && matchStatus && matchPriority
    })
  }, [leads, search, statusFilter, priorityFilter])

  const openCreateModal = () => {
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEditModal = (lead) => {
    setForm({
      ...emptyForm,
      ...lead,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.full_name || !form.phone) {
      setMessage({ type: 'error', text: 'Full name and phone are required.' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        alternate_phone: form.alternate_phone || null,
        email: form.email || null,
        company_name: form.company_name || null,
        status: form.status || 'new',
        priority: form.priority || 'medium',
        source: form.source || 'manual',
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        address: form.address || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      }

      if (form.id) {
        const { error } = await supabase.from('leads').update(payload).eq('id', form.id)
        if (error) throw error
        setMessage({ type: 'success', text: 'Lead updated successfully.' })
      } else {
        const { error } = await supabase.from('leads').insert(payload)
        if (error) throw error
        setMessage({ type: 'success', text: 'Lead created successfully.' })
      }
      closeModal()
      fetchLeads()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save lead.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!form.id) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('leads').delete().eq('id', form.id)
      if (error) throw error
      setDeleteOpen(false)
      closeModal()
      setMessage({ type: 'success', text: 'Lead deleted.' })
      fetchLeads()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete lead.' })
    } finally {
      setDeleting(false)
    }
  }

  const handleInlineFieldUpdate = async (leadId, field, value) => {
    setInlineSavingId(leadId)
    try {
      const { error } = await supabase
        .from('leads')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', leadId)
      if (error) throw error
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, [field]: value, updated_at: new Date().toISOString() } : l)))
    } catch (err) {
      setMessage({ type: 'error', text: err.message || `Failed to update ${field}.` })
    } finally {
      setInlineSavingId('')
    }
  }

  const statCards = [
    { label: 'Total Leads', value: leads.length, icon: Users, tone: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    { label: 'Converted', value: leads.filter((l) => l.status === 'converted').length, icon: TrendingUp, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'Hot Leads', value: leads.filter((l) => ['high', 'urgent'].includes(l.priority)).length, icon: Filter, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-600 mt-1">Track and manage incoming business opportunities.</p>
        </div>
        <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Lead
        </button>
      </div>

      {message.text && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.tone}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{s.label}</p>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lead, phone, company..." className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((v) => <option key={v} value={v}>{toTitleCase(v)}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
            <option value="all">All Priority</option>
            {PRIORITY_OPTIONS.map((v) => <option key={v} value={v}>{toTitleCase(v)}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No leads found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold text-slate-600 uppercase">
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openEditModal(lead)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{lead.full_name}</div>
                      <div className="text-sm text-slate-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        value={lead.status || 'new'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleInlineFieldUpdate(lead.id, 'status', e.target.value)}
                        disabled={inlineSavingId === lead.id}
                        className="w-full min-w-[140px] px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                      >
                        {STATUS_OPTIONS.map((v) => (
                          <option key={v} value={v}>{toTitleCase(v)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        value={lead.priority || 'medium'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleInlineFieldUpdate(lead.id, 'priority', e.target.value)}
                        disabled={inlineSavingId === lead.id}
                        className="w-full min-w-[130px] px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                      >
                        {PRIORITY_OPTIONS.map((v) => (
                          <option key={v} value={v}>{toTitleCase(v)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        value={lead.source || 'manual'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleInlineFieldUpdate(lead.id, 'source', e.target.value)}
                        disabled={inlineSavingId === lead.id}
                        className="w-full min-w-[140px] px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                      >
                        {SOURCE_OPTIONS.map((v) => (
                          <option key={v} value={v}>{toTitleCase(v)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-[280px]">
                      <div className="truncate" title={lead.notes || ''}>
                        {lead.notes || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{lead.updated_at ? new Date(lead.updated_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div className="mx-auto my-6 max-w-3xl rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Lead' : 'Create Lead'}</h2>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Full name *" className="px-3 py-2.5 border rounded-lg" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone *" className="px-3 py-2.5 border rounded-lg" />
              <input value={form.alternate_phone} onChange={(e) => setForm({ ...form, alternate_phone: e.target.value })} placeholder="Alternate phone" className="px-3 py-2.5 border rounded-lg" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="px-3 py-2.5 border rounded-lg" />
              <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Company name" className="px-3 py-2.5 border rounded-lg" />
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-3 py-2.5 border rounded-lg">
                <option value="">Status</option>
                {STATUS_OPTIONS.map((v) => <option key={v} value={v}>{toTitleCase(v)}</option>)}
              </select>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="px-3 py-2.5 border rounded-lg">
                <option value="">Priority</option>
                {PRIORITY_OPTIONS.map((v) => <option key={v} value={v}>{toTitleCase(v)}</option>)}
              </select>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="px-3 py-2.5 border rounded-lg">
                <option value="">Source</option>
                {SOURCE_OPTIONS.map((v) => <option key={v} value={v}>{toTitleCase(v)}</option>)}
              </select>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="px-3 py-2.5 border rounded-lg" />
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" className="px-3 py-2.5 border rounded-lg" />
              <input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="Pincode" className="px-3 py-2.5 border rounded-lg" />
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="px-3 py-2.5 border rounded-lg md:col-span-2" />
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={3} className="px-3 py-2.5 border rounded-lg md:col-span-2" />
            </div>
            <div className="px-4 sm:px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3">
              {form.id ? (
                <button onClick={() => setDeleteOpen(true)} className="px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50">Delete Lead</button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button onClick={closeModal} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving...' : form.id ? 'Update Lead' : 'Create Lead'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete this lead?</h3>
            <p className="text-sm text-slate-600 mb-4">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteOpen(false)} className="px-3 py-2 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-3 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
