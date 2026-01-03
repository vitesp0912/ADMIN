import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FileText, User, Clock, ChevronDown, ChevronUp, AlertCircle, Globe } from 'lucide-react'

export default function AuditLogs() {
  const [pumps, setPumps] = useState([])
  const [selectedPumpId, setSelectedPumpId] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [expandedLogId, setExpandedLogId] = useState(null)
  const LIMIT = 10

  // Fetch pumps on mount
  useEffect(() => {
    fetchPumps()
  }, [])

  // Fetch logs when pump selected or offset changes
  useEffect(() => {
    if (selectedPumpId) {
      fetchLogs(selectedPumpId, offset)
      fetchTotalCount(selectedPumpId)
    }
  }, [selectedPumpId, offset])

  const fetchPumps = async () => {
    try {
      const { data, error } = await supabase
        .from('pumps')
        .select('id, name, pump_code')
        .order('pump_code', { ascending: true })

      if (error) throw error
      setPumps(data || [])
      
      if (data && data.length > 0) {
        setSelectedPumpId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching pumps:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async (pumpId, currentOffset) => {
    setLogsLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('get_audit_logs', { 
          p_pump_id: pumpId, 
          p_limit: LIMIT, 
          p_offset: currentOffset 
        })

      if (error) throw error
      
      if (currentOffset === 0) {
        setLogs(data || [])
      } else {
        setLogs(prev => [...prev, ...(data || [])])
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const fetchTotalCount = async (pumpId) => {
    try {
      const { data, error } = await supabase
        .rpc('get_audit_logs_count', { p_pump_id: pumpId })

      if (error) throw error
      setTotalCount(data || 0)
    } catch (error) {
      console.error('Error fetching count:', error)
    }
  }

  const handlePumpChange = (pumpId) => {
    setSelectedPumpId(pumpId)
    setOffset(0)
    setLogs([])
    setExpandedLogId(null)
  }

  const handleLoadMore = () => {
    setOffset(prev => prev + LIMIT)
  }

  const toggleExpand = (logId) => {
    setExpandedLogId(expandedLogId === logId ? null : logId)
  }

  // Format timestamp to human-friendly format
  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffDays === 0) return `Today at ${timeStr}`
    if (diffDays === 1) return `Yesterday at ${timeStr}`
    if (diffDays < 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    }) + ` at ${timeStr}`
  }

  // Render clean diff view for changes
  const renderChanges = (oldValues, newValues) => {
    if (!oldValues && !newValues) return null

    const changes = []
    const allKeys = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {})
    ])

    // Fields to hide from diff view
    const hiddenFields = ['id', 'created_at', 'updated_at', 'pump_id', 'user_id', 'actor_id']

    allKeys.forEach(key => {
      if (hiddenFields.includes(key)) return
      
      const oldVal = oldValues?.[key]
      const newVal = newValues?.[key]
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: formatFieldName(key),
          oldValue: formatValue(oldVal),
          newValue: formatValue(newVal)
        })
      }
    })

    if (changes.length === 0) return null

    return (
      <div className="mt-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-xs font-medium text-gray-500 mb-3">CHANGES</p>
        <div className="space-y-2">
          {changes.map((change, idx) => (
            <div key={idx} className="flex items-start gap-3 text-sm">
              <span className="text-gray-600 font-medium min-w-24">{change.field}</span>
              <div className="flex items-center gap-2 flex-wrap">
                {change.oldValue && (
                  <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded line-through">
                    {change.oldValue}
                  </span>
                )}
                <span className="text-gray-400">→</span>
                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">
                  {change.newValue || '(empty)'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Format field names to be human-readable
  const formatFieldName = (field) => {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim()
  }

  // Format values for display
  const formatValue = (value) => {
    if (value === null || value === undefined) return null
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') {
      // Format as currency if it looks like a price
      if (value > 10 && value < 1000) return `₹${value.toFixed(2)}`
      return value.toLocaleString()
    }
    if (typeof value === 'object') return JSON.stringify(value)
    
    // Check if it's an ISO date/time string
    const str = String(value)
    if (/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(str)) {
      const date = new Date(str)
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      }
    }
    // Check if it's just a date (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const date = new Date(str + 'T00:00:00')
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      }
    }
    
    return str
  }

  // Get action color
  const getActionColor = (action) => {
    switch (action.toLowerCase()) {
      case 'created': return 'bg-green-100 text-green-800'
      case 'updated': return 'bg-blue-100 text-blue-800'
      case 'deleted': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const hasMore = logs.length < totalCount

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-gray-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Activity Log</h1>
              <p className="text-gray-500 text-sm mt-0.5">Recent changes and updates</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Pump Selector */}
        {!loading && pumps.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Pump
            </label>
            <select
              value={selectedPumpId || ''}
              onChange={(e) => handlePumpChange(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {pumps.map((pump) => (
                <option key={pump.id} value={pump.id}>
                  {pump.name} ({pump.pump_code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !logsLoading && logs.length === 0 && selectedPumpId && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No activity recorded yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Changes to this pump will appear here
            </p>
          </div>
        )}

        {/* Logs List */}
        {logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Main Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Action + Entity */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action_label)}`}>
                          {log.action_label}
                        </span>
                        <span className="text-gray-900 font-medium">
                          {log.entity_label}
                        </span>
                      </div>

                      {/* Reason (if present) */}
                      {log.reason && (
                        <p className="text-gray-600 text-sm mt-2">
                          "{log.reason}"
                        </p>
                      )}

                      {/* Meta: Who + When + IP */}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>{log.actor_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatTime(log.created_at)}</span>
                        </div>
                        {log.ip_address && (
                          <div className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5" />
                            <span>{log.ip_address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expand Button */}
                    {log.has_changes && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 shrink-0"
                      >
                        {expandedLogId === log.id ? (
                          <>
                            <span>Hide details</span>
                            <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span>View details</span>
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {expandedLogId === log.id && log.has_changes && (
                    renderChanges(log.old_values, log.new_values)
                  )}
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={logsLoading}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {logsLoading ? 'Loading...' : 'Load more'}
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  Showing {logs.length} of {totalCount} entries
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial Loading for Logs */}
        {logsLoading && logs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading activity...</p>
          </div>
        )}
      </div>
    </div>
  )
}
