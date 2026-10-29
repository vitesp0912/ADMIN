import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/supabase'
import { formatISTDateTime } from '../lib/datetime'
import StatusPill from '../components/ui/StatusPill'
import EmptyState from '../components/ui/EmptyState'

const STATUSES = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'under_review', label: 'Under review' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
]

const STATUS_LABELS = Object.fromEntries(STATUSES.filter((item) => item.id !== 'all').map((item) => [item.id, item.label]))

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '—'
}

function statusTone(status) {
  if (status === 'completed') return 'ok'
  if (status === 'rejected') return 'danger'
  if (status === 'under_review') return 'warn'
  if (status === 'cancelled') return 'neutral'
  return 'info'
}

function isMissingTable(error) {
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return error?.code === '42P01' || text.includes('account_deletion_requests')
}

export default function AccountDeletionRequests() {
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rows, setRows] = useState([])
  const [pumpsById, setPumpsById] = useState({})
  const [usersById, setUsersById] = useState({})
  const [status, setStatus] = useState('pending')
  const [query, setQuery] = useState('')
  const [reviewing, setReviewing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    setSchemaMissing(false)
    try {
      const { data, error: loadError } = await db
        .from('account_deletion_requests')
        .select('id, pump_id, user_id, reason, status, requested_at, reviewed_at, completed_at, admin_notes, rejection_reason')
        .order('requested_at', { ascending: false })
        .limit(1000)
      if (loadError) throw loadError

      const list = data || []
      const pumpIds = [...new Set(list.map((row) => row.pump_id).filter(Boolean))]
      const userIds = [...new Set(list.map((row) => row.user_id).filter(Boolean))]

      const [pumpResult, userResult] = await Promise.all([
        pumpIds.length
          ? db.from('pumps').select('id, name, pump_code').in('id', pumpIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? db.from('users').select('id, name, phone').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (pumpResult.error) throw pumpResult.error
      if (userResult.error) throw userResult.error

      setRows(list)
      setPumpsById(Object.fromEntries((pumpResult.data || []).map((pump) => [pump.id, pump])))
      setUsersById(Object.fromEntries((userResult.data || []).map((user) => [user.id, user])))
    } catch (loadError) {
      if (isMissingTable(loadError)) {
        setSchemaMissing(true)
        setRows([])
      } else {
        setError(loadError.message || 'Could not load deletion requests')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const next = { all: rows.length }
    for (const item of STATUSES) {
      if (item.id === 'all') continue
      next[item.id] = rows.filter((row) => row.status === item.id).length
    }
    return next
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false
      if (!q) return true
      const pump = pumpsById[row.pump_id]
      const user = usersById[row.user_id]
      const haystack = [
        pump?.name,
        pump?.pump_code,
        user?.name,
        user?.phone,
        row.reason,
        row.admin_notes,
        row.rejection_reason,
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, status, query, pumpsById, usersById])

  const saveReview = async (event) => {
    event.preventDefault()
    if (!reviewing || saving) return
    const nextStatus = reviewing.status
    const rejectionReason = reviewing.rejection_reason.trim()
    if (!STATUSES.some((item) => item.id === nextStatus)) {
      setError('Choose a valid status.')
      return
    }
    if (nextStatus === 'rejected' && !rejectionReason) {
      setError('Add a rejection reason before rejecting this request.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const nowIso = new Date().toISOString()
      const payload = {
        status: nextStatus,
        admin_notes: reviewing.admin_notes.trim() || null,
        rejection_reason: rejectionReason || null,
        reviewed_at: reviewing.reviewed_at || (nextStatus === 'pending' ? null : nowIso),
        completed_at: nextStatus === 'completed' ? (reviewing.completed_at || nowIso) : null,
      }
      const { error: saveError } = await db
        .from('account_deletion_requests')
        .update(payload)
        .eq('id', reviewing.id)
      if (saveError) throw saveError
      setReviewing(null)
      setNotice('Request updated. The pump was not deleted.')
      await load()
    } catch (saveError) {
      setError(saveError.message || 'Could not update the request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pf-page">
      <div className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Deletion requests</h1>
        <p className="pf-meta mt-1">Review account deletion requests. Saving a status does not delete the pump.</p>
      </div>

      {notice && <p className="mb-3 text-[13px] text-ok">{notice}</p>}
      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

      {schemaMissing && (
        <div className="mb-4 p-4 rounded-card bg-warn-soft">
          <p className="text-[14px] font-semibold text-ink">The deletion requests table is not in the database yet</p>
          <p className="text-[13px] text-ink-secondary mt-1">
            Run <span className="font-mono">account_deletion_requests.sql</span> in the Supabase SQL editor, then reload this page.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatus(item.id)}
              className={`h-8 px-3 rounded-control text-[12px] font-semibold border transition-colors ${
                status === item.id
                  ? 'bg-brand-500 text-white border-transparent'
                  : 'bg-surface text-ink-secondary border-line hover:bg-surface-muted'
              }`}
            >
              {item.label}
              <span className="ml-1.5 opacity-80">{counts[item.id] || 0}</span>
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pump code, name, or reason"
          className="pf-input w-full sm:max-w-xs"
        />
      </div>

      {loading ? (
        <p className="text-[13px] text-ink-secondary">Loading requests...</p>
      ) : schemaMissing ? null : visible.length === 0 ? (
        <div className="pf-card">
          <EmptyState title="No deletion requests" description="Requests from pumps will show up here." />
        </div>
      ) : (
        <>
          <ul className="md:hidden space-y-3">
            {visible.map((row) => {
              const pump = pumpsById[row.pump_id]
              const user = usersById[row.user_id]
              return (
                <li key={row.id} className="pf-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {pump ? (
                        <Link to={`/pumps/${pump.id}`} className="text-[14px] font-semibold text-brand-600 dark:text-brand-300 break-words">
                          <span className="font-mono">{pump.pump_code || 'No code'}</span>
                          {pump.name ? <span className="text-ink"> · {pump.name}</span> : null}
                        </Link>
                      ) : (
                        <p className="text-[14px] font-semibold text-ink">Pump unavailable</p>
                      )}
                      <p className="text-[12px] text-ink-secondary mt-1">
                        {user?.name || user?.phone || 'No user'}
                        {user?.phone && user?.name ? ` · ${user.phone}` : ''}
                      </p>
                    </div>
                    <StatusPill tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusPill>
                  </div>
                  <p className="text-[13px] text-ink break-words">{row.reason || 'No reason given'}</p>
                  <p className="text-[12px] text-ink-muted">Requested {formatISTDateTime(row.requested_at)}</p>
                  <button type="button" onClick={() => setReviewing({ ...row, admin_notes: row.admin_notes || '', rejection_reason: row.rejection_reason || '' })} className="pf-btn-secondary w-full">
                    Review
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="hidden md:block pf-card overflow-hidden">
            <div className="pf-table-wrap !border-0 !rounded-none">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Pump</th>
                    <th>User</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const pump = pumpsById[row.pump_id]
                    const user = usersById[row.user_id]
                    return (
                      <tr key={row.id}>
                        <td className="min-w-[10rem]">
                          {pump ? (
                            <Link to={`/pumps/${pump.id}`} className="block">
                              <span className="font-mono text-[12px] text-brand-600 dark:text-brand-300">{pump.pump_code || 'No code'}</span>
                              {pump.name ? <span className="block text-[13px] font-medium text-ink">{pump.name}</span> : null}
                            </Link>
                          ) : (
                            <span className="text-ink-secondary">Pump unavailable</span>
                          )}
                        </td>
                        <td>
                          <span className="block">{user?.name || '—'}</span>
                          {user?.phone ? <span className="block text-[12px] text-ink-muted">{user.phone}</span> : null}
                        </td>
                        <td className="max-w-[16rem]">
                          <span className="block truncate" title={row.reason || ''}>{row.reason || '—'}</span>
                        </td>
                        <td><StatusPill tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusPill></td>
                        <td className="whitespace-nowrap text-ink-secondary">{formatISTDateTime(row.requested_at)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => setReviewing({ ...row, admin_notes: row.admin_notes || '', rejection_reason: row.rejection_reason || '' })}
                            className="text-[12px] font-semibold text-brand-600 dark:text-brand-300"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
          <form onSubmit={saveReview} className="bg-surface rounded-card shadow-soft w-full min-w-0 max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-ink">Review request</h3>
                <p className="text-[13px] text-ink-secondary mt-1 break-words">
                  {pumpsById[reviewing.pump_id]?.pump_code || 'No code'}
                  {pumpsById[reviewing.pump_id]?.name ? ` · ${pumpsById[reviewing.pump_id].name}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setReviewing(null)} disabled={saving} className="pf-btn-ghost !px-2" aria-label="Close">
                ×
              </button>
            </div>

            <p className="text-[13px] text-ink break-words mb-3">{reviewing.reason || 'No reason given'}</p>
            <p className="text-[12px] text-ink-muted mb-3">
              Requested {formatISTDateTime(reviewing.requested_at)}
              {reviewing.reviewed_at ? ` · Reviewed ${formatISTDateTime(reviewing.reviewed_at)}` : ''}
              {reviewing.completed_at ? ` · Completed ${formatISTDateTime(reviewing.completed_at)}` : ''}
            </p>

            <label className="block mb-3">
              <span className="block text-[12px] font-medium text-ink-secondary mb-1">Status</span>
              <select
                value={reviewing.status}
                onChange={(event) => setReviewing((prev) => ({ ...prev, status: event.target.value }))}
                className="pf-input w-full"
                disabled={saving}
              >
                {STATUSES.filter((item) => item.id !== 'all').map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="block mb-3">
              <span className="block text-[12px] font-medium text-ink-secondary mb-1">Admin notes</span>
              <textarea
                value={reviewing.admin_notes}
                onChange={(event) => setReviewing((prev) => ({ ...prev, admin_notes: event.target.value }))}
                rows={3}
                className="pf-input h-auto w-full py-2"
                disabled={saving}
              />
            </label>

            <label className="block mb-4">
              <span className="block text-[12px] font-medium text-ink-secondary mb-1">Rejection reason</span>
              <textarea
                value={reviewing.rejection_reason}
                onChange={(event) => setReviewing((prev) => ({ ...prev, rejection_reason: event.target.value }))}
                rows={3}
                className="pf-input h-auto w-full py-2"
                disabled={saving}
              />
            </label>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" onClick={() => setReviewing(null)} disabled={saving} className="pf-btn-secondary w-full sm:w-auto">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="pf-btn-primary w-full sm:w-auto">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
