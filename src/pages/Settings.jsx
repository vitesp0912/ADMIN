import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Settings as SettingsIcon, Building2, Fuel, Zap } from 'lucide-react'

export default function Settings() {
  const [pumps, setPumps] = useState([])
  const [selectedPumpId, setSelectedPumpId] = useState(null)
  const [pumpMetrics, setPumpMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(false)

  // Fetch all pumps on mount
  useEffect(() => {
    fetchPumps()
  }, [])

  // Fetch metrics when pump is selected
  useEffect(() => {
    if (selectedPumpId) {
      fetchPumpMetrics(selectedPumpId)
    } else {
      setPumpMetrics(null)
    }
  }, [selectedPumpId])

  const fetchPumps = async () => {
    try {
      const { data, error } = await supabase
        .from('pumps')
        .select('id, name, pump_code, address')
        .order('pump_code', { ascending: true })

      if (error) throw error

      setPumps(data || [])
      
      // Auto-select first pump
      if (data && data.length > 0) {
        setSelectedPumpId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching pumps:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPumpMetrics = async (pumpId) => {
    setMetricsLoading(true)
    try {
      // Call the RPC function - single source of truth
      const { data, error } = await supabase
        .rpc('get_pump_operational_metrics', { p_pump_id: pumpId })

      if (error) {
        console.error('Error fetching pump metrics:', error)
        throw error
      }

      if (data && data.length > 0) {
        setPumpMetrics(data[0])
        console.log('Pump Metrics (from DB):', data[0])
      } else {
        setPumpMetrics(null)
      }
    } catch (error) {
      console.error('Error calling get_pump_operational_metrics:', error)
      setPumpMetrics(null)
    } finally {
      setMetricsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pump Settings</h1>
              <p className="text-gray-600 text-sm mt-1">Real-time operational metrics and fuel pricing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading pumps...</div>
          </div>
        ) : pumps.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No pumps found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar - Pump Selector */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow sticky top-8">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-900">SELECT PUMP</h2>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {pumps.map((pump) => (
                    <button
                      key={pump.id}
                      onClick={() => setSelectedPumpId(pump.id)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                        selectedPumpId === pump.id
                          ? 'bg-blue-50 border-l-4 border-l-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{pump.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{pump.pump_code}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Content - Metrics Detail */}
            <div className="lg:col-span-3">
              {metricsLoading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <div className="text-gray-500">Loading metrics...</div>
                </div>
              ) : !pumpMetrics ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Fuel className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Select a pump to view metrics</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-l-blue-600">
                    <h2 className="text-2xl font-bold text-gray-900">{pumpMetrics.pump_name}</h2>
                    <p className="text-gray-600 mt-1">Code: {pumpMetrics.pump_code}</p>
                  </div>

                  {/* Operational Counts */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-gray-600 text-sm font-medium">NOZZLES</p>
                          <p className="text-4xl font-bold text-blue-600 mt-2">
                            {pumpMetrics.nozzle_count || 0}
                          </p>
                        </div>
                        <Zap className="w-8 h-8 text-blue-400 mb-2" />
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-gray-600 text-sm font-medium">FUEL TYPES</p>
                          <p className="text-4xl font-bold text-green-600 mt-2">
                            {pumpMetrics.fuel_type_count || 0}
                          </p>
                        </div>
                        <Fuel className="w-8 h-8 text-green-400 mb-2" />
                      </div>
                    </div>
                  </div>

                  {/* Fuel Pricing Table */}
                  {pumpMetrics.fuel_types && Array.isArray(pumpMetrics.fuel_types) && pumpMetrics.fuel_types.length > 0 ? (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900">FUEL PRICING</h3>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Fuel Type</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">RSP</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">RO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pumpMetrics.fuel_types.map((fuel, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-6 py-3 text-sm text-gray-900 font-medium">{fuel.name}</td>
                              <td className="px-6 py-3 text-sm text-gray-900">
                                ₹{fuel.rsp ? fuel.rsp.toFixed(2) : 'N/A'}
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-900">
                                ₹{fuel.ro ? fuel.ro.toFixed(2) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                      <p className="text-gray-500">No fuel types configured for this pump</p>
                    </div>
                  )}

                  {/* Data Integrity Note */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Data Integrity:</span> All metrics displayed here are sourced directly from the database in real-time. 
                      Nozzle counts, fuel types, and pricing are automatically synced from the pump configuration. 
                      No cached values or calculations are performed on the frontend.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

