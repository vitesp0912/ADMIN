import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Settings as SettingsIcon, Building2 } from 'lucide-react'

export default function Settings() {
  const [settings, setSettings] = useState([])
  const [pumps, setPumps] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setSettings(data || [])

      // Fetch pump names
      const pumpIds = [...new Set((data || []).map((s) => s.pump_id))]
      if (pumpIds.length > 0) {
        const { data: pumpsData, error: pumpsError } = await supabase
          .from('pumps')
          .select('id, name, pump_code')
          .in('id', pumpIds)

        if (!pumpsError && pumpsData) {
          const pumpsMap = {}
          pumpsData.forEach((pump) => {
            pumpsMap[pump.id] = pump
          })
          setPumps(pumpsMap)
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <SettingsIcon className="w-8 h-8 text-orange-600" />
          Settings
        </h1>
        <p className="text-gray-600">View pump-specific settings and configurations</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
        {settings.length === 0 ? (
          <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <SettingsIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No settings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pump
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diesel RSP
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Petrol RSP
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diesel RO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Petrol RO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {settings.map((setting) => (
                  <tr key={setting.id} className="hover:bg-orange-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pumps[setting.pump_id] ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {pumps[setting.pump_id].name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {pumps[setting.pump_id].pump_code}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{parseFloat(setting.diesel_rsp || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{parseFloat(setting.petrol_rsp || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{parseFloat(setting.diesel_ro || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{parseFloat(setting.petrol_ro || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(setting.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 shadow-md">
        <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" />
          Settings Explanation
        </h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <strong className="text-blue-900">RSP (Retail Selling Price):</strong>
            <span>Price at which fuel is sold to customers</span>
          </li>
          <li className="flex items-start gap-2">
            <strong className="text-blue-900">RO (Retail Outlet):</strong>
            <span>Cost price paid to the retail outlet</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

