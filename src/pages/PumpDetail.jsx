import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Building2, Phone, Mail, MapPin, User, Calendar, DollarSign, CheckCircle, XCircle, Settings, Save, ShoppingCart, Gauge, Receipt, Droplets } from 'lucide-react'
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

export default function PumpDetail() {
  const { id } = useParams()
  const [pump, setPump] = useState(null)
  const [users, setUsers] = useState([])
  const [sales, setSales] = useState([])
  const [meterReadings, setMeterReadings] = useState([])
  const [nozzles, setNozzles] = useState({})
  const [fuelTypes, setFuelTypes] = useState({})
  const [expenses, setExpenses] = useState([])
  const [dipEntries, setDipEntries] = useState([])
  const [salaryEntries, setSalaryEntries] = useState([])
  const [dailyTesting, setDailyTesting] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('details')
  const [activeDataTab, setActiveDataTab] = useState('users')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [dataLoading, setDataLoading] = useState({})

  // Management form state
  const [formData, setFormData] = useState({
    is_active: false,
    registration_status: 'pending',
    payment_verified: false,
    subscription_status: 'pending',
    subscription_plan: 'basic',
    subscription_start_date: '',
    subscription_end_date: '',
    billing_cycle: 'monthly',
  })

  useEffect(() => {
    fetchPumpDetails()
    fetchPumpUsers()
  }, [id])

  useEffect(() => {
    if (id && activeDataTab && activeDataTab !== 'users') {
      fetchTabData(activeDataTab)
    }
  }, [id, activeDataTab])

  const fetchPumpDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('pumps')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setPump(data)
      
      // Initialize form data
      setFormData({
        is_active: data.is_active || false,
        registration_status: data.registration_status || 'pending',
        payment_verified: data.payment_verified || false,
        subscription_status: data.subscription_status || 'pending',
        subscription_plan: data.subscription_plan || 'basic',
        subscription_start_date: data.subscription_start_date 
          ? new Date(data.subscription_start_date).toISOString().split('T')[0]
          : '',
        subscription_end_date: data.subscription_end_date
          ? new Date(data.subscription_end_date).toISOString().split('T')[0]
          : '',
        billing_cycle: data.billing_cycle || 'monthly',
      })
    } catch (error) {
      console.error('Error fetching pump details:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPumpUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('pump_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchTabData = async (tab) => {
    setDataLoading(prev => ({ ...prev, [tab]: true }))
    try {
      switch (tab) {
        case 'sales':
          const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (salesError) {
            console.error('Sales fetch error:', salesError)
            throw salesError
          }
          console.log(`Fetched ${salesData?.length || 0} sales records:`, salesData)
          setSales(salesData || [])
          
          // Fetch fuel type names for sales
          const saleFuelTypeIds = [...new Set((salesData || [])
            .map((s) => s.fuel_type_id)
            .filter(Boolean))]
          if (saleFuelTypeIds.length > 0) {
            await fetchFuelTypes(saleFuelTypeIds)
          }
          break

        case 'meter-readings':
          const { data: readingsData, error: readingsError } = await supabase
            .from('nozzle_reading')
            .select('*')
            .eq('pump_id', id)
            .order('date', { ascending: false })
            .limit(500)
          if (readingsError) {
            console.error('Meter readings fetch error:', readingsError)
            throw readingsError
          }
          console.log(`Fetched ${readingsData?.length || 0} meter reading records`)
          setMeterReadings(readingsData || [])

          // Fetch nozzle and fuel type names for this pump
          const nozzleIds = [...new Set((readingsData || []).map((r) => r.nozzle_id))]
          const fuelTypeIds = [...new Set((readingsData || []).map((r) => r.fuel_type_id))].filter(Boolean)

          if (nozzleIds.length > 0) {
            await fetchNozzlesForPump(id, nozzleIds)
          }
          if (fuelTypeIds.length > 0) {
            await fetchFuelTypes(fuelTypeIds)
          }
          break

        case 'expenses':
          const { data: expensesData, error: expensesError } = await supabase
            .from('expenses')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (expensesError) {
            console.error('Expenses fetch error:', expensesError)
            throw expensesError
          }
          console.log(`Fetched ${expensesData?.length || 0} expenses records:`, expensesData)
          setExpenses(expensesData || [])
          break

        case 'dip-entries':
          const { data: dipData, error: dipError } = await supabase
            .from('dip_entries')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (dipError) {
            console.error('Dip entries fetch error:', dipError)
            throw dipError
          }
          console.log(`Fetched ${dipData?.length || 0} dip entries records:`, dipData)
          setDipEntries(dipData || [])
          
          // Fetch fuel type names for dip entries
          const dipFuelTypeIds = [...new Set((dipData || [])
            .map((d) => d.fuel_type_id)
            .filter(Boolean))]
          if (dipFuelTypeIds.length > 0) {
            await fetchFuelTypes(dipFuelTypeIds)
          }
          break

        case 'salary-entries':
          const { data: salaryData, error: salaryError } = await supabase
            .from('salary_entries')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (salaryError) {
            console.error('Salary entries fetch error:', salaryError)
            throw salaryError
          }
          console.log(`Fetched ${salaryData?.length || 0} salary entries records:`, salaryData)
          setSalaryEntries(salaryData || [])
          break

        case 'daily-testing':
          const { data: testingData, error: testingError } = await supabase
            .from('daily_testing')
            .select('*')
            .eq('pump_id', id)
            .order('date', { ascending: false })
            .limit(500)
          if (testingError) {
            console.error('Daily testing fetch error:', testingError)
            throw testingError
          }
          console.log(`Fetched ${testingData?.length || 0} daily testing records:`, testingData)
          setDailyTesting(testingData || [])

          // Fetch fuel type names for daily testing
          const testingFuelTypeIds = [...new Set((testingData || [])
            .map((t) => t.fuel_type_id)
            .filter(Boolean))]
          if (testingFuelTypeIds.length > 0) {
            await fetchFuelTypes(testingFuelTypeIds)
          }
          break
      }
    } catch (error) {
      console.error(`Error fetching ${tab}:`, error)
      // Show error to user
      console.log(`Failed to load ${tab}. Error details:`, error.message, error)
    } finally {
      setDataLoading(prev => ({ ...prev, [tab]: false }))
    }
  }

  const fetchNozzlesForPump = async (pumpId, nozzleIds) => {
    try {
      const { data, error } = await supabase
        .from('nozzle_info')
        .select('*')
        .eq('pump_id', pumpId)
        .in('nozzle_id', nozzleIds)

      if (error) return console.error('Error fetching nozzle info:', error)

      const map = {}
      data?.forEach((nozzle) => {
        const key = `${nozzle.pump_id}:${nozzle.nozzle_id}`
        map[key] = nozzle
      })
      // Merge with existing nozzles instead of replacing
      setNozzles(prev => ({ ...prev, ...map }))
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
      // Merge with existing fuel types instead of replacing
      setFuelTypes(prev => ({ ...prev, ...map }))
    } catch (err) {
      console.error('Error fetching fuel types:', err)
    }
  }

  const handleSaveChanges = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })
    
    try {
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error('You must be logged in to update pump details. Please refresh the page and login again.')
      }
      
      console.log('Current user:', user.email || user.id)
      
      const updateData = {
        is_active: formData.is_active,
        registration_status: formData.registration_status,
        payment_verified: formData.payment_verified,
        subscription_status: formData.subscription_status,
        subscription_plan: formData.subscription_plan,
        billing_cycle: formData.billing_cycle,
        updated_at: new Date().toISOString(),
      }

      // Set payment verification details if being verified
      if (formData.payment_verified && !pump.payment_verified) {
        updateData.payment_verified_at = new Date().toISOString()
        updateData.payment_verified_by = user?.id || null
      }

      // Set subscription dates
      if (formData.subscription_start_date) {
        updateData.subscription_start_date = new Date(formData.subscription_start_date).toISOString()
      }
      if (formData.subscription_end_date) {
        updateData.subscription_end_date = new Date(formData.subscription_end_date).toISOString()
      }

      console.log('Updating pump with data:', updateData)
      console.log('Pump ID:', id)

      const { data, error } = await supabase
        .from('pumps')
        .update(updateData)
        .eq('id', id)
        .select()

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      console.log('Update successful:', data)

      // Activate users when pump is approved or activated
      const shouldActivateUsers = 
        (formData.registration_status === 'approved' && pump.registration_status !== 'approved') ||
        (formData.is_active === true && pump.is_active === false)

      if (shouldActivateUsers) {
        console.log('Activating users for pump:', id)
        const { error: usersError } = await supabase
          .from('users')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('pump_id', id)

        if (usersError) {
          console.error('Error activating users:', usersError)
          // Don't throw error, just log it - pump update was successful
          setMessage({ 
            type: 'success', 
            text: 'Pump updated successfully, but failed to activate users. Please check users manually.' 
          })
        } else {
          console.log('Users activated successfully')
          setMessage({ type: 'success', text: 'Pump details updated successfully! All users have been activated.' })
          fetchPumpUsers() // Refresh users list
        }
      } else {
        setMessage({ type: 'success', text: 'Pump details updated successfully!' })
      }

      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      fetchPumpDetails()
    } catch (error) {
      console.error('Error updating pump:', error)
      const errorMessage = error.message || error.details || error.hint || 'Failed to update pump details. Check console for details.'
      setMessage({ 
        type: 'error', 
        text: `Error: ${errorMessage}. ${error.code ? `Code: ${error.code}` : ''}` 
      })
      setTimeout(() => setMessage({ type: '', text: '' }), 8000)
    } finally {
      setSaving(false)
    }
  }

  const handleQuickApprove = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    setFormData({
      ...formData,
      is_active: true,
      registration_status: 'approved',
      payment_verified: true,
      subscription_status: 'active',
      subscription_start_date: new Date().toISOString().split('T')[0],
    })
    
    // Auto-save (this will also activate users via handleSaveChanges)
    setTimeout(() => {
      handleSaveChanges()
    }, 100)
  }

  if (loading) {
    return <div className="text-center py-12">Loading pump details...</div>
  }

  if (!pump) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Pump not found</p>
        <Link to="/pumps" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Pumps
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link
          to="/pumps"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pumps
        </Link>
      </div>

      {/* Page Header - Cleaner Status Alignment */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{pump.name}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 className="w-4 h-4" />
              <span>Pump Code:</span>
              <span className="font-medium text-gray-700">{pump.pump_code || 'N/A'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                pump.is_active
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {pump.is_active ? '✓ Active' : 'Inactive'}
            </span>
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                pump.registration_status === 'approved'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : pump.registration_status === 'pending'
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {pump.registration_status === 'approved' ? '✓ Approved' : 
               pump.registration_status === 'pending' ? '⏳ Pending' : 
               pump.registration_status === 'rejected' ? '✗ Rejected' : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content - 70/30 Split */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT COLUMN - Pump Data (70%) */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Section Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                Pump Data
              </h2>
            </div>
            
            {/* Tabs - Clean, No Horizontal Scroll */}
            <div className="border-b border-gray-200 bg-white">
              <nav className="flex flex-wrap px-6">
                {[
                  { id: 'users', label: 'Users' },
                  { id: 'sales', label: 'Digital Sales' },
                  { id: 'meter-readings', label: 'Meter Readings' },
                  { id: 'expenses', label: 'Expenses' },
                  { id: 'dip-entries', label: 'Dip Entries' },
                  { id: 'daily-testing', label: 'Daily Testing' },
                  { id: 'salary-entries', label: 'Salaries' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveDataTab(tab.id)
                      fetchTabData(tab.id)
                    }}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeDataTab === tab.id
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">

            {/* Users Tab */}
            {activeDataTab === 'users' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  Users ({users.length})
                </h3>
                {users.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <User className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No users found for this pump</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Last Login
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-blue-50 transition-colors">
                            <td className="px-6 py-3 text-sm font-medium text-gray-900">{user.name || 'N/A'}</td>
                            <td className="px-6 py-3 text-sm text-gray-600">{user.phone}</td>
                            <td className="px-6 py-3">
                              <span className="inline-flex px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                                {user.role ? toTitleCase(user.role) : 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <span
                                className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                  user.is_active
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {user.is_active ? '✓ Active' : '✗ Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-500">
                              {user.last_login_at
                                ? format(new Date(user.last_login_at), 'dd MMM yyyy, HH:mm')
                                : '—'}
                            </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            {/* Sales Tab */}
            {activeDataTab === 'sales' && (
              <div>
                {dataLoading['sales'] ? (
                  <div className="text-center py-8">Loading sales...</div>
                ) : sales.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No sales found for this pump</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Date & Time</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Fuel Type</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Liters</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Price/L</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{format(new Date(sale.date_time), 'dd MMM yyyy HH:mm')}</td>
                            <td className="px-4 py-3 font-medium">{(() => {
                              const fuel = fuelTypes[sale.fuel_type_id]
                              return fuel?.name || fuel?.fuel_type || fuel?.title || sale.fuel_type_id || 'N/A'
                            })()}</td>
                            <td className="px-4 py-3 font-medium">{sale.liters ? parseFloat(sale.liters).toFixed(2) : 'N/A'}</td>
                            <td className="px-4 py-3 font-medium">₹{parseFloat(sale.price_per_liter).toFixed(2)}</td>
                            <td className="px-4 py-3 font-bold">₹{parseFloat(sale.total_amount).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                {sale.payment_mode ? toTitleCase(sale.payment_mode) : 'N/A'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Meter Readings Tab */}
            {activeDataTab === 'meter-readings' && (
              <div>
                {dataLoading['meter-readings'] ? (
                  <div className="text-center py-8">Loading meter readings...</div>
                ) : meterReadings.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Gauge className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No meter readings found for this pump</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Nozzle</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Fuel Type</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Opening</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Closing</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Sales (L)</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">RSP Applied</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">RO Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {meterReadings.map((reading) => (
                          <tr key={reading.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{format(new Date(reading.date), 'dd MMM yyyy')}</td>
                            <td className="px-4 py-3 font-medium">{(() => {
                              const key = `${reading.pump_id}:${reading.nozzle_id}`
                              const nozzle = nozzles[key]
                              return nozzle?.nozzle_name || nozzle?.name || reading.nozzle_id || 'N/A'
                            })()}</td>
                            <td className="px-4 py-3 font-medium">{(() => {
                              const fuel = fuelTypes[reading.fuel_type_id]
                              return fuel?.name || fuel?.fuel_type || fuel?.title || reading.fuel_type_id || 'N/A'
                            })()}</td>
                            <td className="px-4 py-3 font-medium">{parseFloat(reading.opening_reading).toFixed(2)}</td>
                            <td className="px-4 py-3 font-medium">{parseFloat(reading.closing_reading).toFixed(2)}</td>
                            <td className="px-4 py-3 font-bold">{parseFloat(reading.sales).toFixed(2)}</td>
                            <td className="px-4 py-3 font-medium">₹{parseFloat(reading.rsp_applied).toFixed(3)}</td>
                            <td className="px-4 py-3 font-medium">₹{parseFloat(reading.ro_price_applied).toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Expenses Tab */}
            {activeDataTab === 'expenses' && (
              <div>
                {dataLoading['expenses'] ? (
                  <div className="text-center py-8">Loading expenses...</div>
                ) : expenses.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No expenses found for this pump</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Category</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {expenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{format(new Date(expense.date_time), 'dd MMM yyyy')}</td>
                            <td className="px-4 py-3 font-medium">{expense.category ? toTitleCase(expense.category) : 'N/A'}</td>
                            <td className="px-4 py-3">{expense.description || '—'}</td>
                            <td className="px-4 py-3 font-bold text-red-600">₹{parseFloat(expense.amount).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                {expense.payment_mode ? toTitleCase(expense.payment_mode) : 'N/A'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Dip Entries Tab */}
            {activeDataTab === 'dip-entries' && (
              <div>
                {dataLoading['dip-entries'] ? (
                  <div className="text-center py-8">Loading dip entries...</div>
                ) : dipEntries.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Droplets className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No dip entries found for this pump</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Fuel Type</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Tank No</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Dip (cm)</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Stock (L)</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Delivered (L)</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Consumed (L)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {dipEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{format(new Date(entry.date), 'dd MMM yyyy')}</td>
                            <td className="px-4 py-3 font-medium">{(() => {
                              const fuel = fuelTypes[entry.fuel_type_id]
                              return fuel?.name || fuel?.fuel_type || fuel?.title || entry.fuel_type_id || 'N/A'
                            })()}</td>
                            <td className="px-4 py-3">{entry.tank_no || 'N/A'}</td>
                            <td className="px-4 py-3">{parseFloat(entry.dip || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 font-medium">{parseFloat(entry.stock || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 font-medium">{parseFloat(entry.delivered || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 font-medium">{parseFloat(entry.consumed || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Daily Testing Tab */}
            {activeDataTab === 'daily-testing' && (
              <div>
                {dataLoading['daily-testing'] ? (
                  <div className="text-center py-8">Loading daily testing...</div>
                ) : dailyTesting.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Gauge className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No daily testing records found for this pump</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Fuel Type</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Testing Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {dailyTesting.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{format(new Date(entry.date), 'dd MMM yyyy')}</td>
                            <td className="px-4 py-3 font-medium">{(() => {
                              const fuel = fuelTypes[entry.fuel_type_id]
                              return fuel?.name || fuel?.fuel_type || fuel?.title || entry.fuel_type_id || 'N/A'
                            })()}</td>
                            <td className="px-4 py-3 font-medium">{parseFloat(entry.testing_amount || 0).toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Salary Entries Tab */}
            {activeDataTab === 'salary-entries' && (
              <div>
                {dataLoading['salary-entries'] ? (
                  <div className="text-center py-8">Loading salary entries...</div>
                ) : salaryEntries.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No salary entries found for this pump</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Employee Name</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Daily Wage</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Bonus</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Deduction</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {salaryEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{format(new Date(entry.date_time), 'dd MMM yyyy')}</td>
                            <td className="px-4 py-3 font-medium">{entry.name ? toTitleCase(entry.name) : 'N/A'}</td>
                            <td className="px-4 py-3 font-medium">{entry.role ? toTitleCase(entry.role) : 'N/A'}</td>
                            <td className="px-4 py-3">₹{parseFloat(entry.daily_wage || 0).toFixed(2)}</td>
                            <td className="px-4 py-3">₹{parseFloat(entry.bonus || 0).toFixed(2)}</td>
                            <td className="px-4 py-3">₹{parseFloat(entry.deduction || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 font-medium">₹{parseFloat(entry.total_amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Pump Information (30%) */}
        <div className="lg:sticky lg:top-6 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Section Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                Pump Information
              </h2>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200 bg-white">
              <nav className="flex px-6">
                {[
                  { id: 'details', label: 'Details' },
                  { id: 'subscription', label: 'Subscription' },
                  { id: 'management', label: 'Management' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">

              {message.text && (
                <div
                  className={`mb-4 p-3 rounded-lg border ${
                    message.type === 'success'
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {message.type === 'success' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">{message.text}</span>
                  </div>
                </div>
              )}

              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Basic Information</h3>
                
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Pump Name</p>
                          <p className="text-sm font-medium text-gray-900">{pump.name}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Address</p>
                          <p className="text-sm font-medium text-gray-900">{pump.address || 'N/A'}</p>
                          {pump.city && <p className="text-xs text-gray-600 mt-0.5">{pump.city}, {pump.state}</p>}
                          {pump.pincode && <p className="text-xs text-gray-600">PIN: {pump.pincode}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="text-sm font-medium text-gray-900">{pump.phone}</p>
                        </div>
                      </div>

              {pump.email && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Mail className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</p>
                    <p className="font-semibold text-gray-900">{pump.email}</p>
                  </div>
                </div>
              )}

              {pump.gstin && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">GSTIN</p>
                    <p className="font-semibold text-gray-900">{pump.gstin}</p>
                  </div>
                </div>
              )}
            </div>

                <div className="space-y-5">
                  <h3 className="text-lg font-bold text-gray-900 mb-5 pb-2 border-b border-gray-200">Owner Information</h3>
              
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <User className="w-5 h-5 text-pink-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Owner Name</p>
                  <p className="font-semibold text-gray-900">{pump.owner_name || 'N/A'}</p>
                </div>
              </div>

              {pump.owner_phone && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <Phone className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Owner Phone</p>
                    <p className="font-semibold text-gray-900">{pump.owner_phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Created At</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(pump.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Last Active</p>
                  <p className="font-semibold text-gray-900">
                    {pump.last_active_at
                      ? new Date(pump.last_active_at).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className={`p-2 rounded-lg ${pump.payment_verified ? 'bg-green-100' : 'bg-red-100'}`}>
                {pump.payment_verified ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment Verified</p>
                  <p className="font-semibold text-gray-900">
                    {pump.payment_verified ? 'Yes' : 'No'}
                  </p>
                  {pump.payment_verified_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      Verified on: {new Date(pump.payment_verified_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              </div>
            </div>
          </div>
        )}

              {/* Subscription Tab */}
              {activeTab === 'subscription' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Plan</p>
                    <p className="font-bold text-xl text-gray-900">{pump.subscription_plan ? toTitleCase(pump.subscription_plan) : 'N/A'}</p>
                  </div>
                  
                  <div className={`p-5 rounded-xl border hover:shadow-md transition-shadow ${
                    pump.subscription_status === 'active' 
                      ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                      : pump.subscription_status === 'pending'
                      ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
                      : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
                  }`}>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Status</p>
                    <p className="font-bold text-xl text-gray-900">{pump.subscription_status ? toTitleCase(pump.subscription_status) : 'N/A'}</p>
                  </div>
                  
                  <div className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-md transition-shadow">
                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">Billing Cycle</p>
                    <p className="font-bold text-xl text-gray-900">{pump.billing_cycle ? toTitleCase(pump.billing_cycle) : 'N/A'}</p>
                  </div>
                  
                  <div className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200 hover:shadow-md transition-shadow">
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Start Date</p>
                    <p className="font-bold text-lg text-gray-900">
                      {pump.subscription_start_date
                        ? new Date(pump.subscription_start_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="p-5 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl border border-pink-200 hover:shadow-md transition-shadow">
                    <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide mb-2">End Date</p>
                    <p className="font-bold text-lg text-gray-900">
                      {pump.subscription_start_date
                        ? new Date(pump.subscription_end_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

              {/* Management Tab */}
              {activeTab === 'management' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  {pump.registration_status === 'pending' && (
                    <button
                      onClick={handleQuickApprove}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Quick Approve
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-5">
                  {/* Active Status */}
                  <div className="p-5 border-2 border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all">
                    <label className="flex items-center justify-between mb-3">
                      <span className="font-bold text-gray-900">Active Status</span>
                      <button
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 shadow-inner ${
                          formData.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                            formData.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                    <p className="text-sm text-gray-600 font-medium">
                      {formData.is_active ? '✓ Pump is active and can login' : '✗ Pump is inactive'}
                    </p>
                  </div>

                  {/* Registration Status */}
                  <div className="p-5 border-2 border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all">
                    <label className="block font-bold text-gray-900 mb-3">Registration Status</label>
                    <select
                      value={formData.registration_status}
                      onChange={(e) => setFormData({ ...formData, registration_status: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  {/* Payment Verified */}
                  <div className="p-5 border-2 border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all">
                    <label className="flex items-center justify-between mb-3">
                      <span className="font-bold text-gray-900">Payment Verified</span>
                      <button
                        onClick={() => setFormData({ ...formData, payment_verified: !formData.payment_verified })}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 shadow-inner ${
                          formData.payment_verified ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                            formData.payment_verified ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                    <p className="text-sm text-gray-600 font-medium">
                      {formData.payment_verified ? '✓ Payment has been verified' : '✗ Payment not verified'}
                    </p>
                  </div>

                  {/* Subscription Status */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block font-medium text-gray-700 mb-2">Subscription Status</label>
                    <select
                      value={formData.subscription_status}
                      onChange={(e) => setFormData({ ...formData, subscription_status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Subscription Plan */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block font-medium text-gray-700 mb-2">Subscription Plan</label>
                    <select
                      value={formData.subscription_plan}
                      onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  {/* Billing Cycle */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block font-medium text-gray-700 mb-2">Billing Cycle</label>
                    <select
                      value={formData.billing_cycle}
                      onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  {/* Subscription Start Date */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block font-medium text-gray-700 mb-2">Subscription Start Date</label>
                    <input
                      type="date"
                      value={formData.subscription_start_date}
                      onChange={(e) => setFormData({ ...formData, subscription_start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Subscription End Date */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block font-medium text-gray-700 mb-2">Subscription End Date</label>
                    <input
                      type="date"
                      value={formData.subscription_end_date}
                      onChange={(e) => setFormData({ ...formData, subscription_end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
