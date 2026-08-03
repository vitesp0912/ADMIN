import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  Shield,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Filter,
  X,
  RefreshCw,
} from 'lucide-react'
import { formatISTDateTime, formatISTRelativeTime } from '../lib/datetime'

const LIMIT = 20

const ACTION_OPTIONS = [
  { value: 'INSERT', label: 'Created' },
  { value: 'UPDATE', label: 'Updated' },
  { value: 'DELETE', label: 'Deleted' },
]

function formatFieldName(field) {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim()
}

function formatValue(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(str)) {
    return formatISTDateTime(str)
  }
  return str
}

function getActionColor(action) {
  if (action === 'INSERT') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (action === 'UPDATE') return 'bg-info-soft text-info border-transparent'
  if (action === 'DELETE') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-surface-muted text-ink-secondary border-line'
}

function formatActionLabel(action) {
  return ACTION_OPTIONS.find((o) => o.value === action)?.label || action
}

export default function AuthUsersAudit() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [expandedLogId, setExpandedLogId] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    action: '',
    email: '',
  })
  const [activeFilterCount, setActiveFilterCount] = useState(0)

  useEffect(() => {
    const count = Object.values(filters).filter((v) => v !== '').length
    setActiveFilterCount(count)
  }, [filters])

  useEffect(() => {
    setOffset(0)
    setLogs([])
    fetchLogs(0)
    fetchTotalCount()
  }, [filters])

  const applyFilters = useCallback(
    (query) => {
      let q = query
      if (filters.action) q = q.eq('action', filters.action)
      if (filters.email.trim()) {
        q = q.ilike('email', `%${filters.email.trim()}%`)
      }
      if (filters.dateFrom) {
        q = q.gte('created_at', new Date(filters.dateFrom).toISOString())
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo)
        endDate.setHours(23, 59, 59, 999)
        q = q.lte('created_at', endDate.toISOString())
      }
      return q
    },
    [filters]
  )

  const fetchLogs = async (currentOffset) => {
    if (currentOffset === 0) setLoading(true)
    else setLogsLoading(true)

    try {
      let query = supabase
        .from('auth_users_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + LIMIT - 1)

      query = applyFilters(query)

      const { data, error } = await query
      if (error) throw error

      if (currentOffset === 0) setLogs(data || [])
      else setLogs((prev) => [...prev, ...(data || [])])
    } catch (error) {
      console.error('Error fetching auth users audit logs:', error)
    } finally {
      setLoading(false)
      setLogsLoading(false)
    }
  }

  const fetchTotalCount = async () => {
    try {
      let query = supabase
        .from('auth_users_audit_logs')
        .select('*', { count: 'exact', head: true })

      query = applyFilters(query)

      const { count, error } = await query
      if (error) throw error
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching auth users audit count:', error)
    }
  }

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    fetchLogs(newOffset)
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', action: '', email: '' })
  }

  const handleRefresh = () => {
    setOffset(0)
    setLogs([])
    fetchLogs(0)
    fetchTotalCount()
  }

  const renderChanges = (oldValues, newValues, changedFields) => {
    if (!oldValues && !newValues) return null

    const keys =
      changedFields?.length > 0
        ? changedFields
        : [
            ...new Set([
              ...Object.keys(oldValues || {}),
              ...Object.keys(newValues || {}),
            ]),
          ]

    const changes = keys
      .filter((key) => {
        if (!changedFields?.length) {
          return (
            JSON.stringify(oldValues?.[key]) !== JSON.stringify(newValues?.[key])
          )
        }
        return true
      })
      .map((key) => ({
        field: formatFieldName(key),
        oldValue: formatValue(oldValues?.[key]),
        newValue: formatValue(newValues?.[key]),
      }))

    if (changes.length === 0) {
      return (
        <div className="mt-4 bg-surface-muted rounded-lg p-4 border border-line">
          <p className="text-sm text-ink-muted italic">No detailed changes available</p>
        </div>
      )
    }

    return (
      <div className="mt-4 bg-surface-muted rounded-lg p-4 border border-line">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
          What Changed
        </p>
        <div className="space-y-3">
          {changes.map((change, idx) => (
            <div key={idx} className="text-sm">
              <span className="text-ink-secondary font-medium">{change.field}</span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {change.oldValue !== null && (
                  <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded text-sm border border-red-100 break-all">
                    {change.oldValue}
                  </span>
                )}
                {change.oldValue !== null && change.newValue !== null && (
                  <span className="text-ink-muted">→</span>
                )}
                {change.newValue !== null && (
                  <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded text-sm border border-green-100 break-all">
                    {change.newValue || '(empty)'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const hasMore = logs.length < totalCount

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-muted rounded-lg">
                <Shield className="w-5 h-5 text-ink-secondary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-ink">Auth Users Audit</h1>
                <p className="text-ink-muted text-sm">
                  Audit trail of auth.users changes
                </p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={logsLoading || loading}
              className="p-2 text-ink-muted hover:text-ink-secondary hover:bg-surface-muted rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`w-5 h-5 ${logsLoading || loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-surface rounded-lg border border-line p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-ink-secondary">
                {totalCount.toLocaleString('en-IN')} event
                {totalCount === 1 ? '' : 's'}
              </p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'bg-info-soft text-info border border-transparent'
                  : 'bg-surface-muted text-ink-secondary hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-line">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    FROM DATE
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    TO DATE
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    ACTION
                  </label>
                  <select
                    value={filters.action}
                    onChange={(e) => handleFilterChange('action', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Actions</option>
                    {ACTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    USER EMAIL
                  </label>
                  <input
                    type="text"
                    value={filters.email}
                    onChange={(e) => handleFilterChange('email', e.target.value)}
                    placeholder="Search email…"
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {activeFilterCount > 0 && (
                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-ink-secondary hover:text-ink hover:bg-surface-muted rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="bg-surface rounded-lg border border-line p-12 text-center">
            <div className="animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="h-4 bg-gray-200 rounded w-32 mx-auto" />
            </div>
          </div>
        )}

        {!loading && !logsLoading && logs.length === 0 && (
          <div className="bg-surface rounded-lg border border-line p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-ink-secondary text-lg font-medium">
              No auth user changes recorded
            </p>
            <p className="text-ink-muted text-sm mt-1">
              {activeFilterCount > 0
                ? 'Try adjusting your filters'
                : 'Events will appear when auth.users rows change'}
            </p>
          </div>
        )}

        {!loading && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id
              return (
                <div
                  key={log.id}
                  className="bg-surface rounded-lg border border-line overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedLogId(isExpanded ? null : log.id)
                    }
                    className="w-full text-left px-5 py-4 hover:bg-surface-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 bg-surface-muted rounded-lg shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-ink-secondary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getActionColor(log.action)}`}
                            >
                              {formatActionLabel(log.action)}
                            </span>
                            <span className="text-sm font-medium text-ink truncate">
                              {log.email || log.auth_user_id || 'Unknown user'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-muted flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatISTRelativeTime(log.created_at)}
                            </span>
                            {log.actor_email && (
                              <span>by {log.actor_email}</span>
                            )}
                            {log.changed_fields?.length > 0 && (
                              <span>
                                {log.changed_fields.length} field
                                {log.changed_fields.length === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-line">
                      <div className="mt-4 bg-surface-muted rounded-lg p-4 border border-line">
                        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
                          Technical Details
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-ink-muted">Timestamp</span>
                            <p className="text-ink-secondary font-medium">
                              {formatISTDateTime(log.created_at, {
                                withSeconds: true,
                              })}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">Auth User ID</span>
                            <p className="text-ink-secondary font-mono text-xs break-all">
                              {log.auth_user_id || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">Email</span>
                            <p className="text-ink-secondary font-medium break-all">
                              {log.email || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">Phone</span>
                            <p className="text-ink-secondary font-medium">
                              {log.phone || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">Actor</span>
                            <p className="text-ink-secondary font-medium break-all">
                              {log.actor_email || 'System / unknown'}
                            </p>
                          </div>
                          {log.actor_id && (
                            <div>
                              <span className="text-ink-muted">Actor ID</span>
                              <p className="text-ink-secondary font-mono text-xs break-all">
                                {log.actor_id}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {renderChanges(
                        log.old_values,
                        log.new_values,
                        log.changed_fields
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={logsLoading}
                  className="px-4 py-2 text-sm font-medium text-ink-secondary bg-surface border border-line rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-50"
                >
                  {logsLoading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
