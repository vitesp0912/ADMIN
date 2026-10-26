import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../lib/supabase'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  MessageCircle,
  RefreshCw,
  X,
} from 'lucide-react'
import { formatISTDateTime, formatISTRelativeTime } from '../lib/datetime'
import StatusPill from '../components/ui/StatusPill'

const LIMIT = 20

const SESSION_STATUSES = [
  { value: 'open', label: 'Open', tone: 'info' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'expired', label: 'Expired', tone: 'neutral' },
  { value: 'error', label: 'Error', tone: 'danger' },
]

const SESSION_SELECT = `
  id,
  flow_token,
  wa_id,
  pump_id,
  current_screen,
  status,
  payload,
  last_action,
  last_error,
  created_at,
  updated_at,
  expires_at,
  pumps ( id, name, pump_code )
`.replace(/\s+/g, ' ').trim()

function statusTone(status) {
  return SESSION_STATUSES.find((s) => s.value === status)?.tone || 'neutral'
}

function statusLabel(status) {
  return SESSION_STATUSES.find((s) => s.value === status)?.label || status || '—'
}

function nestOne(value) {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function formatJson(value) {
  if (value == null || value === '') return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function screenLabel(screen) {
  if (!screen) return '—'
  return String(screen).replace(/_/g, ' ')
}

export default function WhatsAppFlows({ pumpId }) {
  const [view, setView] = useState('sessions')
  const [sessions, setSessions] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [sessionLogs, setSessionLogs] = useState({})
  const [sessionLogsLoading, setSessionLogsLoading] = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  })

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== '').length,
    [filters]
  )

  const applyPumpMatch = useCallback(
    (query) => {
      if (!pumpId) return query
      const token = `setup:${pumpId}`
      return query.or(
        `pump_id.eq.${pumpId},flow_token.eq.${token},payload->>pump_id.eq.${pumpId}`
      )
    },
    [pumpId]
  )

  const applySessionFilters = useCallback(
    (query) => {
      let q = applyPumpMatch(query)
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.dateFrom) q = q.gte('created_at', new Date(filters.dateFrom).toISOString())
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo)
        endDate.setHours(23, 59, 59, 999)
        q = q.lte('created_at', endDate.toISOString())
      }
      if (filters.search.trim()) {
        const s = filters.search.trim()
        q = q.or(`flow_token.ilike.%${s}%,wa_id.ilike.%${s}%,current_screen.ilike.%${s}%`)
      }
      return q
    },
    [filters, applyPumpMatch]
  )

  const getPumpFlowTokens = async () => {
    if (!pumpId) return []
    let query = db.from('whatsapp_flow_sessions').select('flow_token')
    query = applyPumpMatch(query)
    const { data, error } = await query
    if (error) throw error
    const tokens = [...new Set((data || []).map((row) => row.flow_token).filter(Boolean))]
    const setupToken = `setup:${pumpId}`
    if (!tokens.includes(setupToken)) tokens.push(setupToken)
    return tokens
  }

  const applyLogFilters = useCallback(
    (query) => {
      let q = query
      if (filters.dateFrom) q = q.gte('created_at', new Date(filters.dateFrom).toISOString())
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo)
        endDate.setHours(23, 59, 59, 999)
        q = q.lte('created_at', endDate.toISOString())
      }
      if (filters.search.trim()) {
        const s = filters.search.trim()
        q = q.or(
          `flow_token.ilike.%${s}%,action.ilike.%${s}%,screen.ilike.%${s}%,error_text.ilike.%${s}%`
        )
      }
      return q
    },
    [filters]
  )

  const fetchSessions = async (currentOffset) => {
    if (!db) {
      setLoadError('Admin data client is not configured.')
      setLoading(false)
      return
    }
    if (currentOffset === 0) setLoading(true)
    else setLoadingMore(true)
    try {
      setLoadError('')
      let query = db
        .from('whatsapp_flow_sessions')
        .select(SESSION_SELECT)
        .order('updated_at', { ascending: false })
        .range(currentOffset, currentOffset + LIMIT - 1)
      query = applySessionFilters(query)
      const { data, error } = await query
      if (error) throw error
      const mapped = (data || []).map((row) => ({ ...row, pump: nestOne(row.pumps) }))
      if (currentOffset === 0) setSessions(mapped)
      else setSessions((prev) => [...prev, ...mapped])
    } catch (error) {
      console.error('Error fetching WhatsApp flow sessions:', error)
      setLoadError(error.message || 'Failed to load WhatsApp flow sessions')
      if (currentOffset === 0) setSessions([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const fetchLogs = async (currentOffset) => {
    if (!db) {
      setLoadError('Admin data client is not configured.')
      setLoading(false)
      return
    }
    if (currentOffset === 0) setLoading(true)
    else setLoadingMore(true)
    try {
      setLoadError('')
      const tokens = await getPumpFlowTokens()
      if (tokens.length === 0) {
        if (currentOffset === 0) setLogs([])
        return
      }
      let query = db
        .from('whatsapp_flow_endpoint_logs')
        .select('id, flow_token, action, screen, request, response, error_text, created_at')
        .in('flow_token', tokens)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + LIMIT - 1)
      query = applyLogFilters(query)
      const { data, error } = await query
      if (error) throw error
      if (currentOffset === 0) setLogs(data || [])
      else setLogs((prev) => [...prev, ...(data || [])])
    } catch (error) {
      console.error('Error fetching WhatsApp flow logs:', error)
      setLoadError(error.message || 'Failed to load WhatsApp flow logs')
      if (currentOffset === 0) setLogs([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const fetchTotalCount = async () => {
    if (!db) return
    try {
      if (view === 'logs') {
        const tokens = await getPumpFlowTokens()
        if (tokens.length === 0) {
          setTotalCount(0)
          return
        }
        let query = db
          .from('whatsapp_flow_endpoint_logs')
          .select('*', { count: 'exact', head: true })
          .in('flow_token', tokens)
        query = applyLogFilters(query)
        const { count, error } = await query
        if (error) throw error
        setTotalCount(count || 0)
        return
      }
      let query = db.from('whatsapp_flow_sessions').select('*', { count: 'exact', head: true })
      query = applySessionFilters(query)
      const { count, error } = await query
      if (error) throw error
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching WhatsApp flow count:', error)
    }
  }

  useEffect(() => {
    setOffset(0)
    setExpandedId(null)
    if (view === 'sessions') {
      setSessions([])
      fetchSessions(0)
    } else {
      setLogs([])
      fetchLogs(0)
    }
    fetchTotalCount()
  }, [filters, view, pumpId])

  const loadSessionLogs = async (flowToken) => {
    if (!flowToken || sessionLogs[flowToken] || sessionLogsLoading[flowToken]) return
    setSessionLogsLoading((prev) => ({ ...prev, [flowToken]: true }))
    try {
      const { data, error } = await db
        .from('whatsapp_flow_endpoint_logs')
        .select('id, flow_token, action, screen, request, response, error_text, created_at')
        .eq('flow_token', flowToken)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      setSessionLogs((prev) => ({ ...prev, [flowToken]: data || [] }))
    } catch (error) {
      setSessionLogs((prev) => ({ ...prev, [flowToken]: [] }))
      setLoadError(error.message || 'Failed to load endpoint logs for this session')
    } finally {
      setSessionLogsLoading((prev) => ({ ...prev, [flowToken]: false }))
    }
  }

  const toggleExpand = (row) => {
    const next = expandedId === row.id ? null : row.id
    setExpandedId(next)
    if (next && row.flow_token) loadSessionLogs(row.flow_token)
  }

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    if (view === 'sessions') fetchSessions(newOffset)
    else fetchLogs(newOffset)
  }

  const handleRefresh = () => {
    setOffset(0)
    setExpandedId(null)
    setSessionLogs({})
    if (view === 'sessions') {
      setSessions([])
      fetchSessions(0)
    } else {
      setLogs([])
      fetchLogs(0)
    }
    fetchTotalCount()
  }

  const rows = view === 'sessions' ? sessions : logs
  const hasMore = rows.length < totalCount

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="pf-section-title flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-brand-500 shrink-0" />
            WhatsApp Flows
          </h2>
          <p className="pf-meta mt-0.5">Chatbot sessions and endpoint logs for this pump</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || loadingMore}
          className="p-2 text-ink-muted hover:text-ink-secondary hover:bg-surface-muted rounded-lg disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading || loadingMore ? 'animate-spin' : ''}`} />
        </button>
      </div>
        <div className="flex p-0.5 rounded-control border border-line bg-surface-muted w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setView('sessions')}
            className={`flex-1 sm:flex-none px-3 h-9 rounded-[6px] text-[13px] font-semibold ${
              view === 'sessions' ? 'bg-surface text-ink shadow-soft' : 'text-ink-secondary'
            }`}
          >
            Sessions
          </button>
          <button
            type="button"
            onClick={() => setView('logs')}
            className={`flex-1 sm:flex-none px-3 h-9 rounded-[6px] text-[13px] font-semibold ${
              view === 'logs' ? 'bg-surface text-ink shadow-soft' : 'text-ink-secondary'
            }`}
          >
            Endpoint logs
          </button>
        </div>

        {loadError && (
          <div className="p-4 rounded-lg border border-transparent bg-danger-soft text-danger text-sm">
            {loadError}
          </div>
        )}

        <div className="bg-surface rounded-lg border border-line p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-ink-secondary flex-1">
              {totalCount.toLocaleString('en-IN')} {view === 'sessions' ? 'session' : 'log'}
              {totalCount === 1 ? '' : 's'}
            </p>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                showFilters || activeFilterCount > 0
                  ? 'bg-info-soft text-info'
                  : 'bg-surface-muted text-ink-secondary'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {view === 'sessions' && (
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">STATUS</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface"
                  >
                    <option value="">All statuses</option>
                    {SESSION_STATUSES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">FROM DATE</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">TO DATE</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-ink-muted mb-1.5">SEARCH</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder={view === 'sessions' ? 'WA ID, token, screen…' : 'Token, action, screen…'}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                />
              </div>
              {activeFilterCount > 0 && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setFilters({ status: '', search: '', dateFrom: '', dateTo: '' })}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-ink-secondary hover:bg-surface-muted rounded-lg"
                  >
                    <X className="w-4 h-4" />
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="bg-surface rounded-lg border border-line p-12 text-center text-ink-muted">
            Loading…
          </div>
        )}

        {!loading && rows.length === 0 && !loadError && (
          <div className="bg-surface rounded-lg border border-line p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-ink-secondary text-lg font-medium">
              {view === 'sessions' ? 'No WhatsApp flow sessions' : 'No endpoint logs'}
            </p>
            <p className="text-ink-muted text-sm mt-1">
              Rows appear here when the chatbot links a flow session to this pump.
            </p>
          </div>
        )}

        {!loading && view === 'sessions' && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isExpanded = expandedId === session.id
              const relatedLogs = sessionLogs[session.flow_token]
              return (
                <div key={session.id} className="bg-surface rounded-lg border border-line overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(session)}
                    className="w-full text-left px-4 sm:px-5 py-4 hover:bg-surface-muted/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusPill tone={statusTone(session.status)}>
                            {statusLabel(session.status)}
                          </StatusPill>
                          <span className="text-sm font-semibold text-ink truncate">
                            {session.wa_id || 'Unknown WhatsApp ID'}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-ink-secondary truncate">
                          {screenLabel(session.current_screen)}
                          {session.last_action ? ` · ${session.last_action}` : ''}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-muted flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatISTRelativeTime(session.updated_at || session.created_at)}
                          </span>
                        </div>
                        {session.last_error && (
                          <p className="mt-2 text-xs text-danger line-clamp-2">{session.last_error}</p>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 sm:px-5 pb-5 border-t border-line space-y-4">
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-ink-muted">Flow token</span>
                          <p className="font-mono text-xs break-all text-ink-secondary">{session.flow_token}</p>
                        </div>
                        <div>
                          <span className="text-ink-muted">Created</span>
                          <p className="text-ink-secondary">{formatISTDateTime(session.created_at)}</p>
                        </div>
                        <div>
                          <span className="text-ink-muted">Expires</span>
                          <p className="text-ink-secondary">{formatISTDateTime(session.expires_at)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">
                          Session payload
                        </p>
                        <pre className="text-[11px] leading-relaxed bg-surface-muted border border-line rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                          {formatJson(session.payload)}
                        </pre>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">
                          Endpoint trail
                        </p>
                        {sessionLogsLoading[session.flow_token] ? (
                          <p className="text-sm text-ink-muted">Loading logs…</p>
                        ) : !relatedLogs || relatedLogs.length === 0 ? (
                          <p className="text-sm text-ink-muted">No endpoint logs for this token yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {relatedLogs.map((log) => (
                              <div key={log.id} className="rounded-lg border border-line p-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <StatusPill tone={log.error_text ? 'danger' : 'neutral'}>
                                    {log.action || 'event'}
                                  </StatusPill>
                                  <span className="text-ink-secondary">{screenLabel(log.screen)}</span>
                                  <span className="text-ink-muted">
                                    {formatISTDateTime(log.created_at, { withSeconds: true })}
                                  </span>
                                </div>
                                {log.error_text && (
                                  <p className="mt-2 text-xs text-danger">{log.error_text}</p>
                                )}
                                <details className="mt-2">
                                  <summary className="text-xs text-ink-muted cursor-pointer">
                                    Request / response
                                  </summary>
                                  <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
                                    <pre className="text-[11px] bg-surface-muted border border-line rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                      {formatJson(log.request)}
                                    </pre>
                                    <pre className="text-[11px] bg-surface-muted border border-line rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                      {formatJson(log.response)}
                                    </pre>
                                  </div>
                                </details>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && view === 'logs' && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => {
              const isExpanded = expandedId === log.id
              return (
                <div key={log.id} className="bg-surface rounded-lg border border-line overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="w-full text-left px-4 sm:px-5 py-4 hover:bg-surface-muted/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusPill tone={log.error_text ? 'danger' : 'neutral'}>
                            {log.action || 'event'}
                          </StatusPill>
                          <span className="text-sm text-ink-secondary">{screenLabel(log.screen)}</span>
                        </div>
                        <p className="mt-1.5 text-xs font-mono text-ink-muted truncate">
                          {log.flow_token || 'No flow token'}
                        </p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {formatISTRelativeTime(log.created_at)}
                        </p>
                        {log.error_text && (
                          <p className="mt-2 text-xs text-danger line-clamp-2">{log.error_text}</p>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 sm:px-5 pb-5 border-t border-line">
                      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-ink-muted uppercase mb-2">Request</p>
                          <pre className="text-[11px] bg-surface-muted border border-line rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                            {formatJson(log.request)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-ink-muted uppercase mb-2">Response</p>
                          <pre className="text-[11px] bg-surface-muted border border-line rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                            {formatJson(log.response)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {hasMore && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm font-medium text-ink-secondary bg-surface border border-line rounded-lg hover:bg-surface-muted disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
    </div>
  )
}
