import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Building2, CheckCircle, XCircle, Gauge, Phone, ArrowUpDown } from 'lucide-react'
import { formatISTDateTime, formatISTRelativeTime, phoneToTel } from '../lib/datetime'
import { comparePumpState, getPumpStateMeta, getPumpStateSelectClass, PUMP_STATES } from '../lib/pumpState'

const VALID_STATUS = new Set(['active', 'pending', 'rejected'])
const LIST_UI_KEY = 'petrofi.pumpsList.ui'

const readListUi = () => {
  try {
    return JSON.parse(sessionStorage.getItem(LIST_UI_KEY) || '{}')
  } catch {
    return {}
  }
}

const writeListUi = (patch) => {
  const next = { ...readListUi(), ...patch }
  sessionStorage.setItem(LIST_UI_KEY, JSON.stringify(next))
}

const buildPumpsParams = ({ status, q }) => {
  const params = new URLSearchParams()
  if (status && status !== 'active') params.set('status', status)
  if (q) params.set('q', q)
  return params
}

export default function Pumps() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pumps, setPumps] = useState([])
  const [meterReadings, setMeterReadings] = useState({})
  const [lastActivity, setLastActivity] = useState({})
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [stateUpdatingId, setStateUpdatingId] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [sortByState, setSortByState] = useState(() => Boolean(readListUi().sortByState))
  const pendingScrollY = useRef(null)

  const filterStatus = useMemo(() => {
    const raw = (searchParams.get('status') || 'active').toLowerCase()
    return VALID_STATUS.has(raw) ? raw : 'active'
  }, [searchParams])

  const searchTerm = searchParams.get('q') || ''

  const updateListParams = ({ status = filterStatus, q = searchTerm }) => {
    setSearchParams(buildPumpsParams({ status, q }), { replace: true })
  }

  const setFilterStatus = (status) => {
    const next = VALID_STATUS.has(status) ? status : 'active'
    pendingScrollY.current = null
    writeListUi({ restore: false, scrollY: 0 })
    updateListParams({ status: next, q: searchTerm })
    window.scrollTo(0, 0)
  }

  const setSearchTerm = (value) => {
    updateListParams({ status: filterStatus, q: value })
  }

  useEffect(() => {
    setLoading(true)
    fetchPumps()
  }, [filterStatus])

  // Capture restore intent once when returning from a pump detail page
  useEffect(() => {
    if (loading) return
    const saved = readListUi()
    const savedStatus = saved.status || 'active'
    const savedQ = saved.q || ''
    if (
      saved.restore &&
      savedStatus === filterStatus &&
      savedQ === searchTerm &&
      typeof saved.scrollY === 'number'
    ) {
      pendingScrollY.current = saved.scrollY
      writeListUi({ restore: false })
    }
  }, [loading, filterStatus, searchTerm])

  // Re-apply scroll through list paint + late secondary fetches (meter/activity)
  useEffect(() => {
    if (loading || pendingScrollY.current == null) return
    const y = pendingScrollY.current
    const apply = () => window.scrollTo(0, y)
    apply()
    const raf = requestAnimationFrame(apply)
    const t1 = setTimeout(apply, 50)
    const t2 = setTimeout(apply, 200)
    const t3 = setTimeout(() => {
      apply()
      pendingScrollY.current = null
    }, 400)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [loading, filterStatus, searchTerm, pumps.length, meterReadings, lastActivity])

  const fetchPumps = async () => {
    try {
      let query = supabase.from('pumps').select('*').order('created_at', { ascending: false })

      if (filterStatus === 'active') {
        query = query.eq('is_active', true)
      } else if (filterStatus === 'pending') {
        query = query.eq('registration_status', 'pending')
      } else if (filterStatus === 'rejected') {
        query = query.eq('registration_status', 'rejected')
      }

      const { data, error } = await query

      if (error) throw error
      setPumps(data || [])

      if (data && data.length > 0) {
        const pumpIds = data.map((p) => p.id)
        fetchMeterReadingsForPumps(pumpIds)
        fetchLastActivityForPumps(pumpIds)
      } else {
        setMeterReadings({})
        setLastActivity({})
      }
    } catch (error) {
      console.error('Error fetching pumps:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMeterReadingsForPumps = async (pumpIds) => {
    try {
      const summaries = await Promise.all(
        pumpIds.map(async (pumpId) => {
          const { count, error } = await supabase
            .from('nozzle_reading')
            .select('id', { count: 'exact', head: true })
            .eq('pump_id', pumpId)
          return { pumpId, count: error ? 0 : (count ?? 0) }
        })
      )

      const readingsMap = {}
      summaries.forEach(({ pumpId, count }) => {
        if (count > 0) readingsMap[pumpId] = { count }
      })
      setMeterReadings(readingsMap)
    } catch (error) {
      console.error('Error fetching meter readings:', error)
    }
  }

  const fetchLastActivityForPumps = async (pumpIds) => {
    try {
      const summaries = await Promise.all(
        pumpIds.map(async (pumpId) => {
          const { data, error } = await supabase.rpc('get_audit_logs', {
            p_pump_id: pumpId,
            p_limit: 1,
            p_offset: 0,
          })
          return { pumpId, log: error ? null : (data?.[0] ?? null) }
        })
      )

      const activityMap = {}
      summaries.forEach(({ pumpId, log }) => {
        if (log) activityMap[pumpId] = log
      })
      setLastActivity(activityMap)
    } catch (error) {
      console.error('Error fetching last activity:', error)
    }
  }

  const filteredPumps = useMemo(() => {
    const q = searchTerm.toLowerCase()
    const list = pumps.filter((pump) => {
      if (!q) return true
      return (
        pump.name?.toLowerCase().includes(q) ||
        pump.pump_code?.toLowerCase().includes(q) ||
        pump.phone?.includes(q) ||
        pump.owner_name?.toLowerCase().includes(q)
      )
    })
    if (sortByState) {
      return [...list].sort(comparePumpState)
    }
    return list
  }, [pumps, searchTerm, sortByState])

  const toggleSortByState = () => {
    setSortByState((prev) => {
      const next = !prev
      writeListUi({ sortByState: next })
      return next
    })
  }

  const handleApprovePump = async (e, pumpId) => {
    e.stopPropagation()
    setUpdating(pumpId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Update pump status
      const { error } = await supabase
        .from('pumps')
        .update({
          registration_status: 'approved',
          subscription_status: 'active',
          is_active: true,
          payment_verified: true,
          payment_verified_at: new Date().toISOString(),
          payment_verified_by: user?.id || null,
          subscription_start_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pumpId)

      if (error) throw error

      // Activate all users for this pump
      const { error: usersError } = await supabase
        .from('users')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('pump_id', pumpId)

      if (usersError) {
        console.error('Error activating users:', usersError)
        setMessage({ 
          type: 'success', 
          text: 'Pump approved successfully! Note: Some users may need manual activation.' 
        })
      } else {
        setMessage({ type: 'success', text: 'Pump approved successfully! All users have been activated.' })
      }
      
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      fetchPumps()
    } catch (error) {
      console.error('Error approving pump:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to approve pump' })
      setTimeout(() => setMessage({ type: '', text: '' }), 5000)
    } finally {
      setUpdating(null)
    }
  }

  const handleRejectPump = async (pumpId) => {
    if (!confirm('Are you sure you want to reject this pump registration?')) return
    
    setUpdating(pumpId)
    try {
      const { error } = await supabase
        .from('pumps')
        .update({
          registration_status: 'rejected',
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pumpId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Pump rejected successfully!' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      fetchPumps()
    } catch (error) {
      console.error('Error rejecting pump:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to reject pump' })
      setTimeout(() => setMessage({ type: '', text: '' }), 5000)
    } finally {
      setUpdating(null)
    }
  }

  const handlePumpStateChange = async (e, pump) => {
    e.stopPropagation()
    const nextState = e.target.value || null
    const currentState = pump.pump_state || null
    if (nextState === currentState) return

    setStateUpdatingId(pump.id)
    setPumps((prev) =>
      prev.map((p) => (p.id === pump.id ? { ...p, pump_state: nextState } : p))
    )

    try {
      const { error } = await supabase
        .from('pumps')
        .update({
          pump_state: nextState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pump.id)

      if (error) throw error

      setMessage({
        type: 'success',
        text: `State updated to ${getPumpStateMeta(nextState).label}`,
      })
      setTimeout(() => setMessage({ type: '', text: '' }), 2500)
    } catch (error) {
      console.error('Error updating pump state:', error)
      setPumps((prev) =>
        prev.map((p) => (p.id === pump.id ? { ...p, pump_state: currentState } : p))
      )
      setMessage({ type: 'error', text: error.message || 'Failed to update pump state' })
      setTimeout(() => setMessage({ type: '', text: '' }), 5000)
    } finally {
      setStateUpdatingId(null)
    }
  }

  const handleRowClick = (pumpId, e) => {
    if (e.target.closest('button, select, a')) {
      return
    }
    writeListUi({
      restore: true,
      scrollY: window.scrollY || window.pageYOffset || 0,
      status: filterStatus,
      q: searchTerm,
    })
    navigate(`/pumps/${pumpId}`, {
      state: {
        pumpsStatus: filterStatus,
        pumpsSearch: searchTerm,
      },
    })
  }

  if (loading) {
    return (
      <div className="pf-page flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-ink-secondary font-medium">Loading pumps...</p>
        </div>
      </div>
    )
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

      <div className="mb-8 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-ink mb-1 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-500" />
              Pumps
            </h1>
            <p className="text-ink-secondary text-[13px]">Manage all petrol pumps</p>
            <div className="flex flex-wrap gap-2 mt-4" role="tablist" aria-label="Filter pumps by status">
              {[
                { id: 'active', label: 'Active' },
                { id: 'pending', label: 'Pending' },
                { id: 'rejected', label: 'Rejected' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  role="tab"
                  aria-selected={filterStatus === pill.id}
                  onClick={() => setFilterStatus(pill.id)}
                  className={`h-8 px-3 rounded-control text-[12px] font-semibold border transition-colors ${
                    filterStatus === pill.id
                      ? 'bg-brand-500 text-white border-transparent'
                      : 'bg-surface text-ink-secondary border-line hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:min-w-[280px]">
            <button
              type="button"
              onClick={toggleSortByState}
              className={`h-10 px-3 rounded-control text-[12px] font-semibold border transition-colors inline-flex items-center justify-center gap-2 shrink-0 ${
                sortByState
                  ? 'bg-brand-500 text-white border-transparent'
                  : 'bg-surface text-ink-secondary border-line hover:bg-surface-muted hover:text-ink'
              }`}
              title="Sort pumps by lifecycle state"
            >
              <ArrowUpDown className="w-4 h-4" />
              Sort by state
            </button>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-muted w-4 h-4" />
              <input
                type="text"
                placeholder="Search pumps..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pf-input !pl-9 w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pf-card overflow-hidden">
        {filteredPumps.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-ink-muted mx-auto mb-3 opacity-60" />
            <p className="text-ink-secondary text-[14px] font-medium">No pumps found</p>
          </div>
        ) : (
          <div className="pf-table-wrap !border-0 !rounded-none !max-h-none">
            <table className="pf-table compact table-fixed">
              <thead>
                <tr>
                  <th className="w-24">Pump Code</th>
                  <th>Name</th>
                  <th className="w-36">Phone</th>
                  <th className="w-28">Owner</th>
                  <th className="w-44">State</th>
                  <th className="w-36">Meter Readings</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filteredPumps.map((pump) => (
                  <tr 
                    key={pump.id} 
                    onClick={(e) => handleRowClick(pump.id, e)}
                    className="cursor-pointer"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="font-medium text-ink">{pump.pump_code || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-4 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{pump.name}</div>
                      {pump.address && (
                        <div className="text-sm text-ink-muted truncate">{pump.address}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-ink">
                      <div className="flex items-center gap-2">
                        <span>{pump.phone || 'N/A'}</span>
                        {phoneToTel(pump.phone) && (
                          <a
                            href={`tel:${phoneToTel(pump.phone)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                            title={`Call ${pump.phone}`}
                            aria-label={`Call ${pump.name}`}
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-ink max-w-0">
                      <span className="block truncate" title={pump.owner_name || 'N/A'}>
                        {pump.owner_name || 'N/A'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={pump.pump_state || ''}
                        disabled={stateUpdatingId === pump.id}
                        onChange={(e) => handlePumpStateChange(e, pump)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Change state for ${pump.name}`}
                        className={getPumpStateSelectClass(pump.pump_state)}
                      >
                        <option value="">Not set</option>
                        {PUMP_STATES.map((state) => (
                          <option key={state.value} value={state.value}>
                            {state.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap">
                      {meterReadings[pump.id] ? (
                        <div className="flex items-center gap-2">
                          <Gauge className="w-3.5 h-3.5 text-brand-500" />
                          <span className="text-[13px] font-medium text-ink">
                            {meterReadings[pump.id].count} readings
                          </span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-ink-muted">No readings</span>
                      )}
                    </td>
                    <td className="px-4 py-4 min-w-0">
                      {lastActivity[pump.id] ? (
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink truncate">
                            {lastActivity[pump.id].action_label || lastActivity[pump.id].action}
                            {' · '}
                            {lastActivity[pump.id].entity_label || lastActivity[pump.id].entity_type}
                          </div>
                          <div
                            className="text-xs text-ink-muted mt-0.5 truncate"
                            title={formatISTDateTime(lastActivity[pump.id].created_at, { withSeconds: true })}
                          >
                            {formatISTRelativeTime(lastActivity[pump.id].created_at)}
                            {' · '}
                            {lastActivity[pump.id].actor_name || 'System'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-ink-muted">No activity</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-ink-secondary">
        Showing {filteredPumps.length} of {pumps.length} pumps
      </div>
    </div>
  )
}

