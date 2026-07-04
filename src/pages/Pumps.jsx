import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Search, Building2, CheckCircle, XCircle, Gauge, Phone } from 'lucide-react'
import { formatISTDate, phoneToTel } from '../lib/datetime'

// Helper function to convert text to Title Case
const toTitleCase = (str) => {
  if (!str) return str
  return str
    .toString()
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function Pumps() {
  const navigate = useNavigate()
  const [pumps, setPumps] = useState([])
  const [meterReadings, setMeterReadings] = useState({})
  const [nozzles, setNozzles] = useState({})
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
        fetchMeterReadingsForPumps(data.map(p => p.id))
      } else {
        setMeterReadings({})
        setNozzles({})
      }
    } catch (error) {
      console.error('Error fetching pumps:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMeterReadingsForPumps = async (pumpIds) => {
    try {
      // Per-pump count + latest: a single global query is capped (~1000 rows) and
      // under-counts / picks wrong "latest" when many active pumps have readings.
      const summaries = await Promise.all(
        pumpIds.map(async (pumpId) => {
          const [countRes, latestRes] = await Promise.all([
            supabase
              .from('nozzle_reading')
              .select('id', { count: 'exact', head: true })
              .eq('pump_id', pumpId),
            supabase
              .from('nozzle_reading')
              .select('pump_id, opening_reading, closing_reading, date, nozzle_id, sales, rsp_applied, ro_price_applied, created_at')
              .eq('pump_id', pumpId)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ])
          return {
            pumpId,
            count: countRes.error ? 0 : (countRes.count ?? 0),
            latest: latestRes.error ? null : latestRes.data,
          }
        })
      )

      const readingsMap = {}
      const nozzleIdSet = new Set()
      const nozzlePumpSet = new Set()

      summaries.forEach(({ pumpId, count, latest }) => {
        if (!count) return
        const closing = latest?.closing_reading
        const opening = latest?.opening_reading
        const preferred = closing !== null && closing !== undefined ? closing : opening
        readingsMap[pumpId] = {
          count,
          latest: latest?.date ?? null,
          latestValue: preferred ?? null,
          latestNozzle: latest?.nozzle_id ?? null,
          latestSales: latest?.sales ?? null,
          latestRsp: latest?.rsp_applied ?? null,
          latestRo: latest?.ro_price_applied ?? null,
        }
        if (latest?.nozzle_id) {
          nozzleIdSet.add(latest.nozzle_id)
          nozzlePumpSet.add(pumpId)
        }
      })

      setMeterReadings(readingsMap)

      if (nozzleIdSet.size > 0 && nozzlePumpSet.size > 0) {
        await fetchNozzles(Array.from(nozzlePumpSet), Array.from(nozzleIdSet))
      } else {
        setNozzles({})
      }
    } catch (error) {
      console.error('Error fetching meter readings:', error)
    }
  }

  const fetchNozzles = async (pumpIds, nozzleIds) => {
    try {
      const { data, error } = await supabase
        .from('nozzle_info')
        .select('*')
        .in('pump_id', pumpIds)
        .in('nozzle_id', nozzleIds)

      if (error) {
        console.error('Error fetching nozzle info:', error)
        return
      }

      const map = {}
      data?.forEach((nozzle) => {
        const key = `${nozzle.pump_id}:${nozzle.nozzle_id}`
        map[key] = nozzle
      })
      setNozzles(map)
    } catch (err) {
      console.error('Error fetching nozzle info:', err)
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading pumps...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {message.text && (
        <div
          className={`mb-6 p-4 rounded-xl border-2 shadow-sm ${
            message.type === 'success'
              ? 'bg-gradient-to-r from-green-50 to-green-100 text-green-800 border-green-300'
              : 'bg-gradient-to-r from-red-50 to-red-100 text-red-800 border-red-300'
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
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              Pumps
            </h1>
            <p className="text-gray-600">Manage all petrol pumps</p>
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
                  className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                    filterStatus === pill.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-800'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative w-full lg:w-auto lg:min-w-[280px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search pumps..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
        {filteredPumps.length === 0 ? (
          <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No pumps found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pump Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Meter Readings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPumps.map((pump) => (
                  <tr 
                    key={pump.id} 
                    onClick={(e) => handleRowClick(pump.id, e)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{pump.pump_code || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{pump.name}</div>
                      {pump.address && (
                        <div className="text-sm text-gray-500">{pump.address}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pump.owner_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          pump.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {pump.is_active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          pump.registration_status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : pump.registration_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {pump.registration_status === 'approved' ? '✓ Approved' : 
                         pump.registration_status === 'pending' ? '⏳ Pending' : 
                         pump.registration_status === 'rejected' ? '✗ Rejected' : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{pump.subscription_plan ? toTitleCase(pump.subscription_plan) : 'N/A'}</div>
                      <div className="text-xs text-gray-500 font-medium">{pump.subscription_status ? toTitleCase(pump.subscription_status) : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {meterReadings[pump.id] ? (
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-indigo-500" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {meterReadings[pump.id].count} readings
                            </div>
                            <div className="text-xs text-gray-500">
                              Latest reading: {meterReadings[pump.id].latestValue !== null && meterReadings[pump.id].latestValue !== undefined
                                ? parseFloat(meterReadings[pump.id].latestValue).toFixed(2)
                                : 'N/A'}
                              {(() => {
                                const key = `${pump.id}:${meterReadings[pump.id].latestNozzle}`
                                const nozzle = nozzles[key]
                                const label = nozzle?.nozzle_name || nozzle?.name
                                return meterReadings[pump.id].latestNozzle
                                  ? ` • ${label || `Nozzle ${meterReadings[pump.id].latestNozzle}`}`
                                  : ''
                              })()}
                              {meterReadings[pump.id].latestSales !== null && meterReadings[pump.id].latestSales !== undefined
                                ? ` • Sales ${parseFloat(meterReadings[pump.id].latestSales).toFixed(2)}`
                                : ''}
                              {meterReadings[pump.id].latestRsp !== null && meterReadings[pump.id].latestRsp !== undefined
                                ? ` • RSP ${parseFloat(meterReadings[pump.id].latestRsp).toFixed(3)}`
                                : ''}
                              {meterReadings[pump.id].latestRo !== null && meterReadings[pump.id].latestRo !== undefined
                                ? ` • RO ${parseFloat(meterReadings[pump.id].latestRo).toFixed(3)}`
                                : ''}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No readings</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatISTDate(pump.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredPumps.length} of {pumps.length} pumps
      </div>
    </div>
  )
}

