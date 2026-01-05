import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  FileText, 
  User, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Filter,
  X,
  RefreshCw,
  Shield
} from 'lucide-react'

// ============================================
// AUDIT LOGS PAGE
// ============================================
// A clean, professional audit trail view for admins
// Displays activity logs in a scannable, trustworthy format
// ============================================

export default function AuditLogs() {
  // Core state
  const [pumps, setPumps] = useState([])
  const [selectedPumpId, setSelectedPumpId] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [expandedLogId, setExpandedLogId] = useState(null)
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    action: '',
    entityType: '',
    actorRole: ''
  })
  const [filterOptions, setFilterOptions] = useState({
    actions: [],
    entityTypes: [],
    actorRoles: []
  })
  const [activeFilterCount, setActiveFilterCount] = useState(0)

  const LIMIT = 10

  // ============================================
  // DATA FETCHING
  // ============================================

  // Fetch pumps on mount
  useEffect(() => {
    fetchPumps()
  }, [])

  // Fetch logs when pump or filters change
  useEffect(() => {
    if (selectedPumpId) {
      setOffset(0)
      setLogs([])
      fetchLogs(selectedPumpId, 0)
      fetchTotalCount(selectedPumpId)
      fetchFilterOptions(selectedPumpId)
    }
  }, [selectedPumpId, filters])

  // Count active filters
  useEffect(() => {
    const count = Object.values(filters).filter(v => v !== '').length
    setActiveFilterCount(count)
  }, [filters])

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

  const buildFilterParams = useCallback(() => {
    const params = {
      p_pump_id: selectedPumpId,
      p_limit: LIMIT,
      p_offset: offset
    }
    
    if (filters.dateFrom) {
      params.p_date_from = new Date(filters.dateFrom).toISOString()
    }
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo)
      endDate.setHours(23, 59, 59, 999)
      params.p_date_to = endDate.toISOString()
    }
    if (filters.action) params.p_action = filters.action
    if (filters.entityType) params.p_entity_type = filters.entityType
    if (filters.actorRole) params.p_actor_role = filters.actorRole
    
    return params
  }, [selectedPumpId, filters, offset])

  const fetchLogs = async (pumpId, currentOffset) => {
    setLogsLoading(true)
    try {
      const params = buildFilterParams()
      params.p_offset = currentOffset
      
      const { data, error } = await supabase.rpc('get_audit_logs', params)

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
      const params = { p_pump_id: pumpId }
      
      if (filters.dateFrom) {
        params.p_date_from = new Date(filters.dateFrom).toISOString()
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo)
        endDate.setHours(23, 59, 59, 999)
        params.p_date_to = endDate.toISOString()
      }
      if (filters.action) params.p_action = filters.action
      if (filters.entityType) params.p_entity_type = filters.entityType
      if (filters.actorRole) params.p_actor_role = filters.actorRole

      const { data, error } = await supabase.rpc('get_audit_logs_count', params)

      if (error) throw error
      setTotalCount(data || 0)
    } catch (error) {
      console.error('Error fetching count:', error)
    }
  }

  const fetchFilterOptions = async (pumpId) => {
    try {
      const { data, error } = await supabase.rpc('get_audit_filter_options', { 
        p_pump_id: pumpId 
      })

      if (error) throw error
      if (data && data[0]) {
        setFilterOptions({
          actions: data[0].actions || [],
          entityTypes: data[0].entity_types || [],
          actorRoles: data[0].actor_roles || []
        })
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handlePumpChange = (pumpId) => {
    setSelectedPumpId(pumpId)
    setOffset(0)
    setLogs([])
    setExpandedLogId(null)
    clearFilters()
  }

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    fetchLogs(selectedPumpId, newOffset)
  }

  const toggleExpand = (logId) => {
    setExpandedLogId(expandedLogId === logId ? null : logId)
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      action: '',
      entityType: '',
      actorRole: ''
    })
  }

  const handleRefresh = () => {
    setOffset(0)
    setLogs([])
    fetchLogs(selectedPumpId, 0)
    fetchTotalCount(selectedPumpId)
  }

  // ============================================
  // FORMATTING HELPERS
  // ============================================

  // Format timestamp to human-friendly format (IST)
  const formatTime = (timestamp) => {
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

  // Render clean diff view for changes
  const renderChanges = (oldValues, newValues) => {
    if (!oldValues && !newValues) return null

    const changes = []
    const allKeys = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {})
    ])

    // Fields to hide from diff view (technical/internal)
    const hiddenFields = [
      'id', 'created_at', 'updated_at', 'pump_id', 'user_id', 
      'actor_id', 'data_hash', 'request_id', 'version'
    ]

    allKeys.forEach(key => {
      if (hiddenFields.includes(key)) return
      
      const oldVal = oldValues?.[key]
      const newVal = newValues?.[key]
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: formatFieldName(key),
          fieldKey: key, // Pass raw key for context-aware formatting
          oldValue: formatValue(oldVal, key),
          newValue: formatValue(newVal, key)
        })
      }
    })

    if (changes.length === 0) {
      return (
        <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-500 italic">No detailed changes available</p>
        </div>
      )
    }

    return (
      <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          What Changed
        </p>
        <div className="space-y-3">
          {changes.map((change, idx) => (
            <div key={idx} className="text-sm">
              <span className="text-gray-600 font-medium">{change.field}</span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {change.oldValue !== null && (
                  <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded text-sm border border-red-100">
                    {change.oldValue}
                  </span>
                )}
                {change.oldValue !== null && <span className="text-gray-400">→</span>}
                <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded text-sm border border-green-100">
                  {change.newValue || '(empty)'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render metadata section in expanded view
  const renderMetadata = (log) => {
    return (
      <div className="mt-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Technical Details
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">Timestamp</span>
            <p className="text-slate-700 font-medium">{formatFullTimestamp(log.created_at)}</p>
          </div>
          <div>
            <span className="text-slate-500">Source</span>
            <p className="text-slate-700 font-medium capitalize">{log.source || 'System'}</p>
          </div>
          <div>
            <span className="text-slate-500">Actor Role</span>
            <p className="text-slate-700 font-medium capitalize">{log.actor_role || 'System'}</p>
          </div>
          {log.ip_address && (
            <div>
              <span className="text-slate-500">IP Address</span>
              <p className="text-slate-700 font-mono text-xs">{log.ip_address}</p>
            </div>
          )}
          {log.user_agent && (
            <div className="col-span-2">
              <span className="text-slate-500">Device</span>
              <p className="text-slate-700 text-xs truncate" title={log.user_agent}>
                {formatUserAgent(log.user_agent)}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Format user agent to human-readable
  const formatUserAgent = (ua) => {
    if (!ua) return 'Unknown'
    if (ua.includes('iPhone')) return 'iPhone'
    if (ua.includes('Android')) return 'Android Device'
    if (ua.includes('iPad')) return 'iPad'
    if (ua.includes('Chrome')) return 'Chrome Browser'
    if (ua.includes('Firefox')) return 'Firefox Browser'
    if (ua.includes('Safari')) return 'Safari Browser'
    return ua.substring(0, 50) + (ua.length > 50 ? '...' : '')
  }

  // Format field names to be human-readable
  const formatFieldName = (field) => {
    const fieldMappings = {
      'fuel_price': 'Fuel Price',
      'opening_reading': 'Opening Reading',
      'closing_reading': 'Closing Reading',
      'total_amount': 'Total Amount',
      'payment_mode': 'Payment Mode',
      'is_active': 'Active Status',
      'phone_number': 'Phone Number',
      'fuel_type_id': 'Fuel Type',
      'nozzle_id': 'Nozzle',
      'shift_id': 'Shift',
      'reading_date': 'Reading Date',
      'dip_value': 'Dip Value',
      'stock_liters': 'Stock (Liters)',
      'expense_date': 'Expense Date',
      'expense_type': 'Expense Type',
      'description': 'Description',
      'amount': 'Amount',
      'quantity': 'Quantity'
    }
    
    if (fieldMappings[field]) return fieldMappings[field]
    
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim()
  }

  // Fields that represent quantity/units (NOT currency)
  const unitFields = [
    'opening_reading', 'closing_reading', 'opening', 'closing',
    'meter_reading', 'reading', 'nozzle_reading',
    'quantity', 'liters', 'litres', 'volume',
    'dip_value', 'dip_reading', 'stock_liters', 'stock_litres',
    'opening_stock', 'closing_stock', 'received_qty', 'sold_qty'
  ]

  // Fields that represent currency/money
  const currencyFields = [
    'amount', 'total_amount', 'price', 'fuel_price', 'rate',
    'salary', 'payment', 'revenue', 'cost', 'expense_amount',
    'credit_amount', 'debit_amount', 'balance', 'total', 'subtotal'
  ]

  // Format values for display - context-aware based on field name
  const formatValue = (value, fieldKey = '') => {
    if (value === null || value === undefined) return null
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    
    if (typeof value === 'number') {
      const keyLower = fieldKey.toLowerCase()
      
      // Check if this is a unit/quantity field (meter readings, quantities, etc.)
      const isUnitField = unitFields.some(f => keyLower.includes(f) || keyLower === f)
      
      if (isUnitField) {
        // Format as units with "L" suffix for readings/quantities
        return `${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`
      }
      
      // Check if this is explicitly a currency field
      const isCurrencyField = currencyFields.some(f => keyLower.includes(f) || keyLower === f)
      
      if (isCurrencyField) {
        return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
      
      // Default: plain number formatting (no assumption about currency)
      return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    }
    
    if (typeof value === 'object') return JSON.stringify(value)
    
    const str = String(value)
    
    // Check if it's an ISO date/time string
    if (/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(str)) {
      const date = new Date(str)
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
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

  // Get action badge color
  const getActionColor = (action) => {
    const actionLower = action?.toLowerCase() || ''
    if (actionLower.includes('created') || actionLower.includes('insert')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
    if (actionLower.includes('updated') || actionLower.includes('update') || actionLower.includes('price')) {
      return 'bg-blue-50 text-blue-700 border-blue-200'
    }
    if (actionLower.includes('deleted') || actionLower.includes('delete')) {
      return 'bg-red-50 text-red-700 border-red-200'
    }
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }

  // Get entity icon
  const getEntityIcon = (entityType) => {
    const type = entityType?.toLowerCase() || ''
    if (type.includes('user') || type.includes('staff')) return User
    if (type.includes('setting')) return Shield
    return FileText
  }

  // Format action name for filter dropdown
  const formatActionOption = (action) => {
    const mappings = {
      'INSERT': 'Created',
      'UPDATE': 'Updated',
      'DELETE': 'Deleted',
      'CREATE': 'Created',
      'PRICE_SYNC': 'Price Updated',
      'PRICE_UPDATE': 'Price Updated'
    }
    return mappings[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Format entity type for filter dropdown
  const formatEntityOption = (entity) => {
    const mappings = {
      'meter_reading': 'Meter Reading',
      'nozzle_reading': 'Meter Reading',
      'fuel_type': 'Fuel Type',
      'fuel_types': 'Fuel Type',
      'expense': 'Expense',
      'expenses': 'Expense',
      'sale': 'Sale',
      'sales': 'Sale',
      'dip_entry': 'Dip Entry',
      'dip_entries': 'Dip Entry',
      'salary_entry': 'Salary Entry',
      'salary_entries': 'Salary Entry',
      'pump': 'Pump Settings',
      'pumps': 'Pump Settings',
      'user': 'User',
      'users': 'User'
    }
    return mappings[entity] || entity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const hasMore = logs.length < totalCount

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileText className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Activity Log</h1>
                <p className="text-gray-500 text-sm">Audit trail of all changes</p>
              </div>
            </div>
            
            {selectedPumpId && (
              <button
                onClick={handleRefresh}
                disabled={logsLoading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${logsLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Controls Bar */}
        {!loading && pumps.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Pump Selector */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  PUMP
                </label>
                <select
                  value={selectedPumpId || ''}
                  onChange={(e) => handlePumpChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                >
                  {pumps.map((pump) => (
                    <option key={pump.id} value={pump.id}>
                      {pump.name} ({pump.pump_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Toggle */}
              <div className="flex items-end">
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
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Date From */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      FROM DATE
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      TO DATE
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Action Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      ACTION
                    </label>
                    <select
                      value={filters.action}
                      onChange={(e) => handleFilterChange('action', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Actions</option>
                      {filterOptions.actions.map((action) => (
                        <option key={action} value={action}>
                          {formatActionOption(action)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Entity Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      ENTITY
                    </label>
                    <select
                      value={filters.entityType}
                      onChange={(e) => handleFilterChange('entityType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Entities</option>
                      {filterOptions.entityTypes.map((entity) => (
                        <option key={entity} value={entity}>
                          {formatEntityOption(entity)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actor Role */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      PERFORMED BY
                    </label>
                    <select
                      value={filters.actorRole}
                      onChange={(e) => handleFilterChange('actorRole', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Anyone</option>
                      {filterOptions.actorRoles.map((role) => (
                        <option key={role} value={role}>
                          {role === 'system' ? 'System' : role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                      ))}
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
        )}

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
        {!loading && !logsLoading && logs.length === 0 && selectedPumpId && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium">No audit activity recorded</p>
            <p className="text-gray-400 text-sm mt-1">
              {activeFilterCount > 0 
                ? 'Try adjusting your filters to see more results'
                : 'Changes to this pump will appear here'
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

        {/* Logs List */}
        {logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => {
              const EntityIcon = getEntityIcon(log.entity_label)
              return (
                <div
                  key={log.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors"
                >
                  {/* Main Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Action + Entity Row */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getActionColor(log.action_label)}`}>
                            {log.action_label}
                          </span>
                          <span className="text-gray-900 font-medium flex items-center gap-1.5">
                            <EntityIcon className="w-4 h-4 text-gray-400" />
                            {log.entity_label}
                          </span>
                        </div>

                        {/* Reason (if present) */}
                        {log.reason && (
                          <p className="text-gray-600 text-sm mt-2 italic">
                            "{log.reason}"
                          </p>
                        )}

                        {/* Meta: Who + When */}
                        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            <span>{log.actor_name}</span>
                            {log.actor_role && log.actor_role !== 'system' && (
                              <span className="text-gray-400">({log.actor_role})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTime(log.created_at)}</span>
                          </div>
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
                    {expandedLogId === log.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        {log.has_changes && renderChanges(log.old_values, log.new_values)}
                        {renderMetadata(log)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

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
                    'Load more'
                  )}
                </button>
                <p className="text-xs text-gray-400 mt-3">
                  Showing {logs.length} of {totalCount.toLocaleString()} entries
                </p>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && logs.length > 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-gray-400">
                  End of activity log • {totalCount.toLocaleString()} total entries
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial Loading for Logs */}
        {logsLoading && logs.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-16 bg-gray-200 rounded"></div>
                  <div className="h-5 w-24 bg-gray-200 rounded"></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-20 bg-gray-100 rounded"></div>
                  <div className="h-4 w-28 bg-gray-100 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
