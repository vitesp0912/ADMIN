import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Gauge } from 'lucide-react'
import { format } from 'date-fns'

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

export default function MeterReadings() {
  const [readings, setReadings] = useState([])
  const [pumps, setPumps] = useState({})
  const [nozzles, setNozzles] = useState({})
  const [fuelTypes, setFuelTypes] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchReadings()
  }, [])

  const fetchReadings = async () => {
    try {
      const { data, error } = await supabase
        .from('nozzle_reading')
        .select('*')
        .order('date', { ascending: false })
        .limit(1000)

      if (error) throw error

      setReadings(data || [])

      const pumpIds = [...new Set((data || []).map((r) => r.pump_id))]
      const nozzleIds = [...new Set((data || []).map((r) => r.nozzle_id))]
      const fuelTypeIds = [...new Set((data || []).map((r) => r.fuel_type_id))].filter(Boolean)

      // Fetch pump names
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

      // Fetch nozzle names for these pumps
      if (pumpIds.length > 0 && nozzleIds.length > 0) {
        await fetchNozzles(pumpIds, nozzleIds)
      }

      // Fetch fuel type names
      if (fuelTypeIds.length > 0) {
        await fetchFuelTypes(fuelTypeIds)
      }
    } catch (error) {
      console.error('Error fetching meter readings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchNozzles = async (pumpIds, nozzleIds) => {
    try {
      const { data, error } = await supabase
        .from('nozzle_info')
        .select('*')
        .in('pump_id', pumpIds)
        .in('nozzle_id', nozzleIds)

      if (error) return console.error('Error fetching nozzle info:', error)

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

  const fetchFuelTypes = async (fuelTypeIds) => {
    try {
      const { data, error } = await supabase
        .from('fuel_types')
        .select('*')
        .in('id', fuelTypeIds)

      if (error) return console.error('Error fetching fuel types:', error)

      const map = {}
      data?.forEach((fuel) => {
        map[fuel.id] = fuel
      })
      setFuelTypes(map)
    } catch (err) {
      console.error('Error fetching fuel types:', err)
    }
  }

  const filteredReadings = readings.filter((reading) => {
    const nozzleKey = `${reading.pump_id}:${reading.nozzle_id}`
    const nozzleName = nozzles[nozzleKey]?.nozzle_name || nozzles[nozzleKey]?.name || ''
    const fuelName = fuelTypes[reading.fuel_type_id]?.name || fuelTypes[reading.fuel_type_id]?.fuel_type || fuelTypes[reading.fuel_type_id]?.title || ''
    const matchesSearch =
      pumps[reading.pump_id]?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pumps[reading.pump_id]?.pump_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nozzleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reading.nozzle_id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      fuelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reading.fuel_type_id?.toString().toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading meter readings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Gauge className="w-8 h-8 text-indigo-600" />
            Meter Readings
          </h1>
          <p className="text-gray-600">View all meter readings</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search readings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
        {filteredReadings.length === 0 ? (
          <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <Gauge className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No meter readings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pump
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nozzle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fuel Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opening Reading
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Closing Reading
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RSP Applied
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RO Price
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReadings.map((reading) => (
                  <tr key={reading.id} className="hover:bg-indigo-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(reading.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pumps[reading.pump_id] ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {pumps[reading.pump_id].name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {pumps[reading.pump_id].pump_code}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {(() => {
                        const key = `${reading.pump_id}:${reading.nozzle_id}`
                        const nozzle = nozzles[key]
                        return nozzle?.nozzle_name || nozzle?.name || reading.nozzle_id || 'N/A'
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {(() => {
                        const fuel = fuelTypes[reading.fuel_type_id]
                        return fuel?.name || fuel?.fuel_type || fuel?.title || reading.fuel_type_id || 'N/A'
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {reading.opening_reading !== null && reading.opening_reading !== undefined
                        ? parseFloat(reading.opening_reading).toFixed(2)
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {reading.closing_reading !== null && reading.closing_reading !== undefined
                        ? parseFloat(reading.closing_reading).toFixed(2)
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reading.sales !== null && reading.sales !== undefined
                        ? parseFloat(reading.sales).toFixed(2)
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reading.rsp_applied !== null && reading.rsp_applied !== undefined
                        ? parseFloat(reading.rsp_applied).toFixed(3)
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reading.ro_price_applied !== null && reading.ro_price_applied !== undefined
                        ? parseFloat(reading.ro_price_applied).toFixed(3)
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

