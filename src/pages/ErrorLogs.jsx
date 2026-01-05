import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  AlertTriangle,
  Clock, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Filter,
  X,
  RefreshCw,
  Smartphone,
  Monitor,
  CheckCircle,
  XCircle,
  User,
  MapPin,
  Code,
  Layers
} from 'lucide-react'

// ============================================
// ERROR LOGS PAGE
// ============================================
// Displays application errors for admin monitoring
// Shows all errors across all pumps with pagination
// ============================================

export default function ErrorLogs() {
  // Core state
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [expandedLogId, setExpandedLogId] = useState(null)
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    errorType: '',
    screenName: '',
    showResolved: '' // '', 'true', 'false'
  })
  const [filterOptions, setFilterOptions] = useState({
    errorTypes: [],
    screenNames: []
  })
  const [activeFilterCount, setActiveFilterCount] = useState(0)

  const LIMIT = 20

  // ============================================
  // DATA FETCHING
  // ============================================

  // Initial fetch on mount
  useEffect(() => {
    fetchLogs(0)
    fetchTotalCount()
    fetchFilterOptions()
  }, [])

  // Refetch when filters change
  useEffect(() => {
    setOffset(0)
    setLogs([])
    fetchLogs(0)
    fetchTotalCount()
  }, [filters])

  // Count active filters
  useEffect(() => {
    const count = Object.values(filters).filter(v => v !== '').length
    setActiveFilterCount(count)
  }, [filters])

  const buildFilterParams = useCallback((currentOffset) => {
    const params = {
      p_limit: LIMIT,
      p_offset: currentOffset
    }
    
    if (filters.errorType) params.p_error_type = filters.errorType
    if (filters.screenName) params.p_screen_name = filters.screenName
    if (filters.showResolved !== '') {
      params.p_show_resolved = filters.showResolved === 'true'
    }
    
    return params
  }, [filters])

  const fetchLogs = async (currentOffset) => {
    if (currentOffset === 0) {
      setLoading(true)
    } else {
      setLogsLoading(true)
    }
    
    try {
      const params = buildFilterParams(currentOffset)
      
      const { data, error } = await supabase.rpc('get_error_logs', params)

      if (error) throw error
      
      if (currentOffset === 0) {
        setLogs(data || [])
      } else {
        setLogs(prev => [...prev, ...(data || [])])
      }
    } catch (error) {
      console.error('Error fetching error logs:', error)
    } finally {
      setLoading(false)
      setLogsLoading(false)
    }
  }

  const fetchTotalCount = async () => {
    try {
      const params = {}
      
      if (filters.errorType) params.p_error_type = filters.errorType
      if (filters.screenName) params.p_screen_name = filters.screenName
      if (filters.showResolved !== '') {
        params.p_show_resolved = filters.showResolved === 'true'
      }

      const { data, error } = await supabase.rpc('get_error_logs_count', params)

      if (error) throw error
      setTotalCount(data || 0)
    } catch (error) {
      console.error('Error fetching count:', error)
    }
  }

  const fetchFilterOptions = async () => {
    try {
      const { data, error } = await supabase.rpc('get_error_filter_options')

      if (error) throw error
      if (data && data[0]) {
        setFilterOptions({
          errorTypes: data[0].error_types || [],
          screenNames: data[0].screen_names || []
        })
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    fetchLogs(newOffset)
  }

  const toggleExpand = (logId) => {
    setExpandedLogId(expandedLogId === logId ? null : logId)
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      errorType: '',
      screenName: '',
      showResolved: ''
    })
  }

  const handleRefresh = () => {
    setOffset(0)
    setLogs([])
    fetchLogs(0)
    fetchTotalCount()
  }

  // ============================================
  // FORMATTING HELPERS
  // ============================================

  // Format timestamp to human-friendly format (IST)
  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffDays = Math.floor(diffMs / 86400000)

    const timeStr = date.toLocaleTimeString('en-IN', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    })

    const dateStr = date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      timeZone: 'Asia/Kolkata'
    })

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffDays === 0) return `Today, ${timeStr}`
    if (diffDays === 1) return `Yesterday, ${timeStr}`
    if (diffDays < 7) return `${diffDays} days ago`
    
    return `${dateStr}, ${timeStr}`
  }

  // Format full timestamp for details view
  const formatFullTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    }) + ' IST'
  }

  // Get error type badge color
  const getErrorTypeColor = (errorType) => {
    const type = errorType?.toLowerCase() || ''
    if (type.includes('network')) return 'bg-orange-50 text-orange-700 border-orange-200'
    if (type.includes('auth')) return 'bg-purple-50 text-purple-700 border-purple-200'
    if (type.includes('validation')) return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    if (type.includes('database')) return 'bg-red-50 text-red-700 border-red-200'
    if (type.includes('permission')) return 'bg-pink-50 text-pink-700 border-pink-200'
    if (type.includes('timeout')) return 'bg-amber-50 text-amber-700 border-amber-200'
    if (type.includes('payment')) return 'bg-rose-50 text-rose-700 border-rose-200'
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }

  // Format device info for display
  const formatDeviceInfo = (deviceInfo) => {
    if (!deviceInfo) return null
    
    const parts = []
    if (deviceInfo.platform) parts.push(deviceInfo.platform)
    if (deviceInfo.os) parts.push(deviceInfo.os)
    if (deviceInfo.model) parts.push(deviceInfo.model)
    if (deviceInfo.brand) parts.push(deviceInfo.brand)
    
    return parts.length > 0 ? parts.join(' • ') : JSON.stringify(deviceInfo)
  }

  // Format error type for filter dropdown
  const formatErrorTypeOption = (errorType) => {
    const mappings = {
      'NETWORK_ERROR': 'Network Error',
      'AUTH_ERROR': 'Authentication Error',
      'VALIDATION_ERROR': 'Validation Error',
      'DATABASE_ERROR': 'Database Error',
      'API_ERROR': 'API Error',
      'PERMISSION_ERROR': 'Permission Denied',
      'NOT_FOUND': 'Not Found',
      'TIMEOUT': 'Timeout',
      'SYNC_ERROR': 'Sync Error',
      'PAYMENT_ERROR': 'Payment Error',
      'UPLOAD_ERROR': 'Upload Error'
    }
    return mappings[errorType] || errorType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Format screen name for filter dropdown
  const formatScreenOption = (screen) => {
    if (!screen) return 'Unknown'
    return screen.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase()).trim()
  }

  // Render error details section
  const renderErrorDetails = (log) => {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
        {/* Error Message & Stack */}
        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
            Error Details
          </p>
          <p className="text-sm text-red-800 font-medium mb-2">{log.error_message}</p>
          {log.error_code && (
            <p className="text-xs text-red-600 mb-2">Code: {log.error_code}</p>
          )}
          {log.error_stack && (
            <details className="mt-2">
              <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
                View Stack Trace
              </summary>
              <pre className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded overflow-x-auto max-h-40">
                {log.error_stack}
              </pre>
            </details>
          )}
        </div>

        {/* Context Info */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Context
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Timestamp</span>
              <p className="text-slate-700 font-medium">{formatFullTimestamp(log.created_at)}</p>
            </div>
            <div>
              <span className="text-slate-500">Screen</span>
              <p className="text-slate-700 font-medium">{log.screen_label || 'Unknown'}</p>
            </div>
            {log.action_attempted && (
              <div>
                <span className="text-slate-500">Action Attempted</span>
                <p className="text-slate-700 font-medium">{log.action_attempted}</p>
              </div>
            )}
            {log.pump_name && (
              <div>
                <span className="text-slate-500">Pump</span>
                <p className="text-slate-700 font-medium">{log.pump_name}</p>
              </div>
            )}
            {log.phone && (
              <div>
                <span className="text-slate-500">User Phone</span>
                <p className="text-slate-700 font-mono text-xs">{log.phone}</p>
              </div>
            )}
            {log.app_version && (
              <div>
                <span className="text-slate-500">App Version</span>
                <p className="text-slate-700 font-mono text-xs">{log.app_version}</p>
              </div>
            )}
          </div>
        </div>

        {/* Device Info */}
        {log.device_info && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Device
            </p>
            <p className="text-sm text-gray-700">{formatDeviceInfo(log.device_info)}</p>
          </div>
        )}

        {/* Input Data (if present) */}
        {log.input_data && Object.keys(log.input_data).length > 0 && (
          <details className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <summary className="text-xs font-semibold text-amber-600 uppercase tracking-wide cursor-pointer">
              Input Data (Debug)
            </summary>
            <pre className="mt-2 text-xs text-amber-800 bg-amber-100 p-2 rounded overflow-x-auto max-h-32">
              {JSON.stringify(log.input_data, null, 2)}
            </pre>
          </details>
        )}

        {/* Resolution Status */}
        {log.is_resolved && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
              Resolved
            </p>
            <div className="text-sm text-green-700">
              <p>Resolved at: {formatFullTimestamp(log.resolved_at)}</p>
              {log.resolved_by_name && <p>By: {log.resolved_by_name}</p>}
            </div>
          </div>
        )}
      </div>
    )
  }

  const hasMore = logs.length < totalCount

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Error Logs</h1>
                <p className="text-gray-500 text-sm">Application errors and issues</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <span className="text-sm text-gray-500 mr-2">
                  {totalCount.toLocaleString()} total errors
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading || logsLoading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${(loading || logsLoading) ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Filters Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Quick Stats */}
            <div className="flex-1 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-red-600">
                <XCircle className="w-4 h-4" />
                <span>Unresolved: {logs.filter(l => !l.is_resolved).length}</span>
              </div>
              <div className="flex items-center gap-1.5 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>Resolved: {logs.filter(l => l.is_resolved).length}</span>
              </div>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Error Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    ERROR TYPE
                  </label>
                  <select
                    value={filters.errorType}
                    onChange={(e) => handleFilterChange('errorType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    {filterOptions.errorTypes.map((type) => (
                      <option key={type} value={type}>
                        {formatErrorTypeOption(type)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Screen Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    SCREEN
                  </label>
                  <select
                    value={filters.screenName}
                    onChange={(e) => handleFilterChange('screenName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Screens</option>
                    {filterOptions.screenNames.map((screen) => (
                      <option key={screen} value={screen}>
                        {formatScreenOption(screen)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Resolution Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    STATUS
                  </label>
                  <select
                    value={filters.showResolved}
                    onChange={(e) => handleFilterChange('showResolved', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Errors</option>
                    <option value="false">Unresolved Only</option>
                    <option value="true">Resolved Only</option>
                  </select>
                </div>

                {/* Clear Filters */}
                {activeFilterCount > 0 && (
                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
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

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !logsLoading && logs.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium">No errors found</p>
            <p className="text-gray-400 text-sm mt-1">
              {activeFilterCount > 0 
                ? 'Try adjusting your filters to see more results'
                : 'All systems are running smoothly'
              }
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Error Logs List */}
        {logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`bg-white rounded-lg border overflow-hidden transition-colors ${
                  log.is_resolved 
                    ? 'border-green-200 bg-green-50/30' 
                    : 'border-gray-200 hover:border-red-200'
                }`}
              >
                {/* Main Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Error Type + Screen */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getErrorTypeColor(log.error_type)}`}>
                          {log.error_type_label}
                        </span>
                        <span className="text-gray-500 text-sm flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          {log.screen_label || 'Unknown Screen'}
                        </span>
                        {log.is_resolved && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" />
                            Resolved
                          </span>
                        )}
                      </div>

                      {/* Error Message Preview */}
                      <p className="text-gray-800 text-sm mt-2 line-clamp-2">
                        {log.error_message}
                      </p>

                      {/* Meta Info */}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatTime(log.created_at)}</span>
                        </div>
                        {log.pump_name && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{log.pump_name}</span>
                          </div>
                        )}
                        {log.phone && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            <span>{log.phone}</span>
                          </div>
                        )}
                        {log.app_version && (
                          <div className="flex items-center gap-1.5">
                            <Code className="w-3.5 h-3.5" />
                            <span>v{log.app_version}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expand Button */}
                    <button
                      onClick={() => toggleExpand(log.id)}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 shrink-0 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {expandedLogId === log.id ? (
                        <>
                          <span>Hide</span>
                          <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <span>Details</span>
                          <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {expandedLogId === log.id && renderErrorDetails(log)}
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center pt-6 pb-4">
                <button
                  onClick={handleLoadMore}
                  disabled={logsLoading}
                  className="px-8 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {logsLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    'Show more'
                  )}
                </button>
                <p className="text-xs text-gray-400 mt-3">
                  Showing {logs.length} of {totalCount.toLocaleString()} errors
                </p>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && logs.length > 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-gray-400">
                  End of error logs • {totalCount.toLocaleString()} total entries
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
