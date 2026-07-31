import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Bell } from 'lucide-react'
import StatusPill from './ui/StatusPill'

export default function PasswordResetBell({ className = '' }) {
  const [open, setOpen] = useState(false)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [clearLoading, setClearLoading] = useState({})
  const rootRef = useRef(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, role, forgot_password_requested_at')
        .eq('forgot_password_requested', true)
        .order('forgot_password_requested_at', { ascending: true })
      if (error) throw error
      setRequests(data || [])
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
    const onFocus = () => fetchRequests()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(fetchRequests, 60000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [fetchRequests])

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleClear = async (userId) => {
    setClearLoading((prev) => ({ ...prev, [userId]: true }))
    try {
      const { error } = await supabase
        .from('users')
        .update({ forgot_password_requested: false, forgot_password_requested_at: null })
        .eq('id', userId)
      if (!error) setRequests((prev) => prev.filter((u) => u.id !== userId))
    } finally {
      setClearLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const count = requests.length
  const hasRequests = count > 0

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) fetchRequests()
        }}
        className={`relative inline-flex items-center justify-center h-9 w-9 rounded-control border transition-colors ${
          hasRequests
            ? 'border-warn bg-warn-soft text-warn animate-pulse'
            : 'border-transparent text-ink-secondary hover:bg-surface-muted hover:text-ink'
        }`}
        aria-label={
          hasRequests
            ? `${count} password reset request${count > 1 ? 's' : ''}`
            : 'Password reset requests'
        }
        aria-expanded={open}
        title={
          hasRequests
            ? `${count} password reset request${count > 1 ? 's' : ''}`
            : 'Password reset requests'
        }
      >
        <Bell className={`w-4 h-4 ${hasRequests ? 'fill-current' : ''}`} />
        {hasRequests && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-warn text-[10px] font-bold text-white flex items-center justify-center shadow-soft ring-2 ring-surface">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(100vw-1.5rem,360px)] z-50 pf-card shadow-lift overflow-hidden animate-fade-in">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2 bg-surface-muted/40">
            <div>
              <p className="text-[13px] font-semibold text-ink">Password resets</p>
              <p className="text-[11px] text-ink-secondary">Clear after assisting the user</p>
            </div>
            <StatusPill tone={hasRequests ? 'warn' : 'ok'}>{count}</StatusPill>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && requests.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-ink-muted">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
                No pending password reset requests
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {requests.map((u) => (
                  <li key={u.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink truncate">{u.name || '—'}</p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {u.phone || '—'} · {u.role || '—'}
                      </p>
                      {u.forgot_password_requested_at && (
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {new Date(u.forgot_password_requested_at).toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="pf-btn-secondary !h-8 shrink-0"
                      disabled={clearLoading[u.id]}
                      onClick={() => handleClear(u.id)}
                    >
                      {clearLoading[u.id] ? 'Clearing…' : 'Clear'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
