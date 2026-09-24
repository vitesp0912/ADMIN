import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../lib/supabase'
import {
  CreditCard,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Filter,
  X,
  RefreshCw,
  Building2,
  User,
} from 'lucide-react'
import { formatISTDateTime, formatISTRelativeTime } from '../lib/datetime'
import { formatInr } from '../lib/format'
import StatusPill from '../components/ui/StatusPill'

const LIMIT = 20

const STATUS_OPTIONS = [
  { value: 'created', label: 'Created', tone: 'neutral' },
  { value: 'pending', label: 'Pending', tone: 'warn' },
  { value: 'paid', label: 'Paid', tone: 'ok' },
  { value: 'failed', label: 'Failed', tone: 'danger' },
  { value: 'expired', label: 'Expired', tone: 'neutral' },
  { value: 'user_dropped', label: 'User dropped', tone: 'warn' },
]

const PAYMENT_SELECT = `
  id,
  order_id,
  cf_order_id,
  user_id,
  pump_id,
  amount_total,
  currency,
  gstin,
  billing_name,
  billing_email,
  billing_phone,
  status,
  payment_session_id,
  cf_payment_id,
  payment_method,
  paid_at,
  created_at,
  updated_at,
  plan_id,
  plans ( id, code, name, price_total_inr ),
  pumps ( id, name, pump_code ),
  users ( id, name, phone, email )
`.replace(/\s+/g, ' ').trim()

function statusTone(status) {
  return STATUS_OPTIONS.find((o) => o.value === status)?.tone || 'neutral'
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label || status || '—'
}

function nestOne(value) {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function normalizePaymentRow(row) {
  if (!row) return null
  return {
    ...row,
    plan: nestOne(row.plans),
    pump: nestOne(row.pumps),
    user: nestOne(row.users),
  }
}

export default function PaymentHistory({ pumpId: pumpIdProp = null, embedded = false } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const lockedPumpId = pumpIdProp || null
  const urlPumpId = searchParams.get('pump_id') || ''
  const pumpIdFilter = lockedPumpId || urlPumpId || ''
  const [pumpIdInput, setPumpIdInput] = useState(urlPumpId)

  useEffect(() => {
    setPumpIdInput(urlPumpId)
  }, [urlPumpId])

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [showFilters, setShowFilters] = useState(Boolean(pumpIdFilter && !lockedPumpId))
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    search: '',
  })

  const activeFilterCount = useMemo(() => {
    let count = Object.values(filters).filter((v) => v !== '').length
    if (!lockedPumpId && pumpIdFilter) count += 1
    return count
  }, [filters, lockedPumpId, pumpIdFilter])

  useEffect(() => {
    setOffset(0)
    setOrders([])
    fetchOrders(0)
    fetchTotalCount()
  }, [filters, pumpIdFilter])

  const applyFilters = useCallback(
    (query) => {
      let q = query
      if (pumpIdFilter) q = q.eq('pump_id', pumpIdFilter)
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.dateFrom) {
        q = q.gte('created_at', new Date(filters.dateFrom).toISOString())
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo)
        endDate.setHours(23, 59, 59, 999)
        q = q.lte('created_at', endDate.toISOString())
      }
      if (filters.search.trim()) {
        const s = filters.search.trim()
        q = q.or(
          [
            `order_id.ilike.%${s}%`,
            `cf_order_id.ilike.%${s}%`,
            `cf_payment_id.ilike.%${s}%`,
            `billing_name.ilike.%${s}%`,
            `billing_email.ilike.%${s}%`,
            `billing_phone.ilike.%${s}%`,
            `gstin.ilike.%${s}%`,
          ].join(',')
        )
      }
      return q
    },
    [filters, pumpIdFilter]
  )

  const fetchOrders = async (currentOffset) => {
    if (!db) {
      setLoadError('Admin data client is not configured (missing service role key).')
      setLoading(false)
      return
    }

    if (currentOffset === 0) setLoading(true)
    else setOrdersLoading(true)

    try {
      setLoadError('')
      let query = db
        .from('payment_orders')
        .select(PAYMENT_SELECT)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + LIMIT - 1)

      query = applyFilters(query)

      const { data, error } = await query
      if (error) throw error

      const mapped = (data || []).map(normalizePaymentRow)
      if (currentOffset === 0) setOrders(mapped)
      else setOrders((prev) => [...prev, ...mapped])
    } catch (error) {
      console.error('Error fetching payment orders:', error)
      setLoadError(error.message || 'Failed to load payment history')
      if (currentOffset === 0) setOrders([])
    } finally {
      setLoading(false)
      setOrdersLoading(false)
    }
  }

  const fetchTotalCount = async () => {
    if (!db) return
    try {
      let query = db
        .from('payment_orders')
        .select('*', { count: 'exact', head: true })

      query = applyFilters(query)

      const { count, error } = await query
      if (error) throw error
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching payment orders count:', error)
    }
  }

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    fetchOrders(newOffset)
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', status: '', search: '' })
    if (!lockedPumpId) {
      setPumpIdInput('')
      if (urlPumpId) {
        const next = new URLSearchParams(searchParams)
        next.delete('pump_id')
        setSearchParams(next, { replace: true })
      }
    }
  }

  const handlePumpIdFilterChange = (value) => {
    if (lockedPumpId) return
    const next = new URLSearchParams(searchParams)
    const trimmed = value.trim()
    if (trimmed) next.set('pump_id', trimmed)
    else next.delete('pump_id')
    setSearchParams(next, { replace: true })
  }

  const commitPumpIdFilter = () => {
    if (lockedPumpId) return
    if (pumpIdInput.trim() === urlPumpId) return
    handlePumpIdFilterChange(pumpIdInput)
  }

  const handleRefresh = () => {
    setOffset(0)
    setOrders([])
    fetchOrders(0)
    fetchTotalCount()
  }

  const hasMore = orders.length < totalCount

  const content = (
    <>
      {!embedded && (
        <div className="bg-surface border-b border-line sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-surface-muted rounded-lg">
                  <CreditCard className="w-5 h-5 text-ink-secondary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-ink">Payment History</h1>
                  <p className="text-ink-muted text-sm">
                    {pumpIdFilter
                      ? `Orders for pump ${pumpIdFilter}`
                      : 'Payment orders across all petrol pumps'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={ordersLoading || loading}
                className="p-2 text-ink-muted hover:text-ink-secondary hover:bg-surface-muted rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-5 h-5 ${ordersLoading || loading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? 'space-y-4' : 'max-w-5xl mx-auto px-6 py-6'}>
        {embedded && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Payment history</h3>
              <p className="pf-meta mt-0.5">
                Filtered by pump id · {pumpIdFilter || '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={ordersLoading || loading}
              className="p-2 text-ink-muted hover:text-ink-secondary hover:bg-surface-muted rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`w-5 h-5 ${ordersLoading || loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        )}
        {loadError && (
          <div className="mb-6 p-4 rounded-lg border border-transparent bg-danger-soft text-danger text-sm">
            {loadError}
          </div>
        )}

        <div className="bg-surface rounded-lg border border-line p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-ink-secondary">
                {totalCount.toLocaleString('en-IN')} order
                {totalCount === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
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
                {!lockedPumpId && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-ink-muted mb-1.5">
                      PUMP ID
                    </label>
                    <input
                      type="text"
                      value={pumpIdInput}
                      onChange={(e) => setPumpIdInput(e.target.value)}
                      onBlur={commitPumpIdFilter}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitPumpIdFilter()
                        }
                      }}
                      placeholder="Filter by pump UUID"
                      className="w-full px-3 py-2 border border-line rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
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
                    STATUS
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    SEARCH
                  </label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Order ID, phone, email…"
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {activeFilterCount > 0 && (
                  <div className="flex items-end">
                    <button
                      type="button"
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

        {!loading && !ordersLoading && orders.length === 0 && !loadError && (
          <div className="bg-surface rounded-lg border border-line p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-ink-secondary text-lg font-medium">No payment orders found</p>
            <p className="text-ink-muted text-sm mt-1">
              {activeFilterCount > 0 || pumpIdFilter
                ? 'Try adjusting your filters'
                : 'Orders will appear here when dealers make payments'}
            </p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => {
              const isExpanded = expandedId === order.id
              const pumpName = order.pump?.name || 'Unknown pump'
              const planName = order.plan?.name || order.plan?.code || 'No plan'
              return (
                <div
                  key={order.id}
                  className="bg-surface rounded-lg border border-line overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="w-full text-left px-5 py-4 hover:bg-surface-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 bg-surface-muted rounded-lg shrink-0 mt-0.5">
                          <CreditCard className="w-4 h-4 text-ink-secondary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusPill tone={statusTone(order.status)}>
                              {statusLabel(order.status)}
                            </StatusPill>
                            <span className="text-sm font-semibold text-ink">
                              {formatInr(order.amount_total, { digits: 2 })}
                            </span>
                            <span className="text-xs text-ink-muted uppercase">
                              {order.currency || 'INR'}
                            </span>
                          </div>
                          <div className="mt-1.5 text-sm text-ink-secondary truncate">
                            {planName}
                            {!lockedPumpId && (
                              <>
                                {' · '}
                                {pumpName}
                                {order.pump?.pump_code ? ` (${order.pump.pump_code})` : ''}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-muted flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatISTRelativeTime(order.created_at)}
                            </span>
                            <span className="font-mono truncate">{order.order_id}</span>
                            {order.payment_method && <span>{order.payment_method}</span>}
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
                          Order details
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-ink-muted">Created</span>
                            <p className="text-ink-secondary font-medium">
                              {formatISTDateTime(order.created_at, { withSeconds: true })}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">Paid at</span>
                            <p className="text-ink-secondary font-medium">
                              {order.paid_at
                                ? formatISTDateTime(order.paid_at, { withSeconds: true })
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">Order ID</span>
                            <p className="text-ink-secondary font-mono text-xs break-all">
                              {order.order_id}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">CF order ID</span>
                            <p className="text-ink-secondary font-mono text-xs break-all">
                              {order.cf_order_id || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">CF payment ID</span>
                            <p className="text-ink-secondary font-mono text-xs break-all">
                              {order.cf_payment_id || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">Payment method</span>
                            <p className="text-ink-secondary font-medium">
                              {order.payment_method || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> Pump
                            </span>
                            <p className="text-ink-secondary font-medium">
                              {order.pump ? (
                                <Link
                                  to={`/pumps/${order.pump_id}`}
                                  className="text-info hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {pumpName}
                                  {order.pump.pump_code ? ` (${order.pump.pump_code})` : ''}
                                </Link>
                              ) : (
                                order.pump_id || '—'
                              )}
                            </p>
                            {order.pump_id && !lockedPumpId && (
                              <p className="mt-1">
                                <Link
                                  to={`/payment-history?pump_id=${order.pump_id}`}
                                  className="text-xs text-info hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View all payments for this pump
                                </Link>
                              </p>
                            )}
                          </div>
                          <div>
                            <span className="text-ink-muted">Plan</span>
                            <p className="text-ink-secondary font-medium">
                              {planName}
                              {order.plan?.code ? (
                                <span className="ml-2 text-xs font-mono text-ink-muted">
                                  {order.plan.code}
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted flex items-center gap-1">
                              <User className="w-3 h-3" /> User
                            </span>
                            <p className="text-ink-secondary font-medium">
                              {order.user?.name || order.billing_name || '—'}
                            </p>
                            <p className="text-xs text-ink-muted mt-0.5">
                              {[order.user?.phone || order.billing_phone, order.user?.email || order.billing_email]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-ink-muted">GSTIN</span>
                            <p className="text-ink-secondary font-mono text-xs">
                              {order.gstin || '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={ordersLoading}
                  className="px-4 py-2 text-sm font-medium text-ink-secondary bg-surface border border-line rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-50"
                >
                  {ordersLoading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )

  if (embedded) return content

  return <div className="min-h-screen bg-surface-muted">{content}</div>
}
