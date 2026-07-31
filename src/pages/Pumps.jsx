import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Search, Building2, CheckCircle, XCircle, Gauge, Phone } from 'lucide-react'
import { formatISTDateTime, formatISTRelativeTime, phoneToTel } from '../lib/datetime'
import StatusPill from '../components/ui/StatusPill'

export default function Pumps() {
  const navigate = useNavigate()
  const [pumps, setPumps] = useState([])
  const [meterReadings, setMeterReadings] = useState({})
  const [lastActivity, setLastActivity] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [updating, setUpdating] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    setLoading(true)
    fetchPumps()
  }, [filterStatus])

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

  const filteredPumps = pumps.filter((pump) => {
    const matchesSearch =
      pump.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pump.pump_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pump.phone?.includes(searchTerm) ||
      pump.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

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

  const handleRowClick = (pumpId, e) => {
    // Don't navigate if clicking on a button
    if (e.target.closest('button')) {
      return
    }
    navigate(`/pumps/${pumpId}`)
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
          <div className="relative w-full lg:w-auto lg:min-w-[280px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Search pumps..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pf-input !pl-9"
            />
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
                  <th className="w-32">Registration</th>
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
                    <td className="whitespace-nowrap">
                      <StatusPill
                        tone={
                          pump.registration_status === 'approved'
                            ? 'info'
                            : pump.registration_status === 'pending'
                              ? 'warn'
                              : 'danger'
                        }
                      >
                        {pump.registration_status || 'N/A'}
                      </StatusPill>
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

