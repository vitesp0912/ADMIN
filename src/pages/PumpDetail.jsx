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
  const [expenses, setExpenses] = useState([])
  const [dipEntries, setDipEntries] = useState([])
  const [salaryEntries, setSalaryEntries] = useState([])
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
    setDataLoading({ ...dataLoading, [tab]: true })
    try {
      switch (tab) {
        case 'sales':
          const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (salesError) throw salesError
          setSales(salesData || [])
          break

        case 'meter-readings':
          const { data: readingsData, error: readingsError } = await supabase
            .from('meter_readings')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (readingsError) throw readingsError
          setMeterReadings(readingsData || [])
          break

        case 'expenses':
          const { data: expensesData, error: expensesError } = await supabase
            .from('expenses')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (expensesError) throw expensesError
          setExpenses(expensesData || [])
          break

        case 'dip-entries':
          const { data: dipData, error: dipError } = await supabase
            .from('dip_entries')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (dipError) throw dipError
          setDipEntries(dipData || [])
          break

        case 'salary-entries':
          const { data: salaryData, error: salaryError } = await supabase
            .from('salary_entries')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (salaryError) throw salaryError
          setSalaryEntries(salaryData || [])
          break
      }
    } catch (error) {
      console.error(`Error fetching ${tab}:`, error)
    } finally {
      setDataLoading({ ...dataLoading, [tab]: false })
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mb-6">
      <Link
        to="/pumps"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pumps
      </Link>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{pump.name}</h1>
            <p className="text-gray-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Pump Code: <span className="font-semibold text-gray-700">{pump.pump_code || 'N/A'}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
                pump.is_active
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {pump.is_active ? '✓ Active' : 'Inactive'}
            </span>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
                pump.registration_status === 'approved'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                  : pump.registration_status === 'pending'
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white'
                  : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
              }`}
            >
              {pump.registration_status === 'approved' ? '✓ Approved' : 
               pump.registration_status === 'pending' ? '⏳ Pending' : 
               pump.registration_status === 'rejected' ? '✗ Rejected' : 'N/A'}
            </span>
          </div>
        </div>

        {/* Two Card Layout */}
        <div className="grid grid-cols-1 gap-6">
          {/* Card 1: Details, Subscription, Management */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Settings className="w-6 h-6 text-blue-600" />
              Pump Information
            </h2>
            
            {/* Tabs for Card 1 */}
        <div className="border-b border-gray-200 mb-6">
              <nav className="flex gap-2">
                {[
                  { id: 'details', label: 'Details' },
                  { id: 'subscription', label: 'Subscription' },
                  { id: 'management', label: 'Management' },
                ].map((tab) => (
              <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 px-4 border-b-2 font-semibold transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 bg-blue-50 rounded-t-lg'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-t-lg'
                    }`}
                  >
                    {tab.label}
              </button>
            ))}
          </nav>
        </div>

            {message.text && (
              <div
                className={`mb-6 p-4 rounded-lg border-2 shadow-sm ${
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

        {/* Details Tab */}
        {activeTab === 'details' && (
              <div className="space-y-8">
                <div className="space-y-5">
                  <h3 className="text-lg font-bold text-gray-900 mb-5 pb-2 border-b border-gray-200">Basic Information</h3>
              
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pump Name</p>
                  <p className="font-semibold text-gray-900">{pump.name}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MapPin className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Address</p>
                  <p className="font-semibold text-gray-900">{pump.address || 'N/A'}</p>
                  {pump.city && <p className="text-sm text-gray-600 mt-1">{pump.city}, {pump.state}</p>}
                  {pump.pincode && <p className="text-sm text-gray-600 mt-1">PIN: {pump.pincode}</p>}
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Phone className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                  <p className="font-semibold text-gray-900">{pump.phone}</p>
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

          {/* Card 2: Users, Sales, Meter Readings, Expenses, Dip Entries, Salaries */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-purple-600" />
              Pump Data
            </h2>
            
            {/* Tabs for Card 2 */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'users', label: 'Users' },
                  { id: 'sales', label: 'Sales' },
                  { id: 'meter-readings', label: 'Meter Readings' },
                  { id: 'expenses', label: 'Expenses' },
                  { id: 'dip-entries', label: 'Dip Entries' },
                  { id: 'salary-entries', label: 'Salaries' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveDataTab(tab.id)
                      fetchTabData(tab.id)
                    }}
                    className={`pb-3 px-4 border-b-2 font-semibold transition-all duration-200 whitespace-nowrap ${
                      activeDataTab === tab.id
                        ? 'border-purple-600 text-purple-600 bg-purple-50 rounded-t-lg'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-t-lg'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

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
                            <td className="px-6 py-4 font-medium text-gray-900">{user.name || 'N/A'}</td>
                            <td className="px-6 py-4 text-gray-700">{user.phone}</td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                {user.role ? toTitleCase(user.role) : 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  user.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {user.is_active ? '✓ Active' : '✗ Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {user.last_login_at
                                ? new Date(user.last_login_at).toLocaleString()
                                : 'Never'}
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
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Sales Transactions</h3>
            {dataLoading['sales'] ? (
              <div className="text-center py-8">Loading sales...</div>
            ) : sales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No sales found for this pump</p>
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Transactions</p>
                    <p className="text-2xl font-bold text-gray-800">{sales.length}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-2xl font-bold text-gray-800">
                      ₹{sales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Liters</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {sales.reduce((sum, s) => sum + (parseFloat(s.liters) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Date & Time</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Shift</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Nozzle</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Fuel Type</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Liters</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Price/L</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Payment</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Customer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{format(new Date(sale.date_time), 'dd MMM yyyy HH:mm')}</td>
                          <td className="px-4 py-3 font-medium">{sale.shift ? toTitleCase(sale.shift) : 'N/A'}</td>
                          <td className="px-4 py-3 font-medium">{sale.nozzle || 'N/A'}</td>
                          <td className="px-4 py-3 font-medium">{sale.fuel_type ? toTitleCase(sale.fuel_type) : 'N/A'}</td>
                          <td className="px-4 py-3 font-medium">{sale.liters ? parseFloat(sale.liters).toFixed(2) : 'N/A'}</td>
                          <td className="px-4 py-3 font-medium">₹{parseFloat(sale.price_per_liter).toFixed(2)}</td>
                          <td className="px-4 py-3 font-bold">₹{parseFloat(sale.total_amount).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                              {sale.payment_mode ? toTitleCase(sale.payment_mode) : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{sale.customer_name ? toTitleCase(sale.customer_name) : 'N/A'}</div>
                            {sale.vehicle_number && <div className="text-xs text-gray-500 font-medium">{sale.vehicle_number.toUpperCase()}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
              )}
              </div>
            )}

            {/* Meter Readings Tab */}
            {activeDataTab === 'meter-readings' && (
              <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Meter Readings</h3>
            {dataLoading['meter-readings'] ? (
              <div className="text-center py-8">Loading meter readings...</div>
            ) : meterReadings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Gauge className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No meter readings found for this pump</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Date & Time</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Shift</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Nozzle</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Fuel Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Reading Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Reading Value</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {meterReadings.map((reading) => (
                      <tr key={reading.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{format(new Date(reading.date_time), 'dd MMM yyyy HH:mm')}</td>
                        <td className="px-4 py-3">{reading.shift}</td>
                        <td className="px-4 py-3">{reading.nozzle}</td>
                        <td className="px-4 py-3">{reading.fuel_type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            reading.reading_type === 'start' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {reading.reading_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{parseFloat(reading.reading_value).toFixed(2)}</td>
                        <td className="px-4 py-3">{reading.difference ? parseFloat(reading.difference).toFixed(2) : 'N/A'}</td>
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
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Expenses</h3>
            {dataLoading['expenses'] ? (
              <div className="text-center py-8">Loading expenses...</div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No expenses found for this pump</p>
              </div>
            ) : (
              <>
                <div className="mb-4 bg-red-50 p-4 rounded-lg inline-block">
                  <p className="text-sm text-gray-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-gray-800">
                    ₹{expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Date & Time</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Category</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Payment Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {expenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{format(new Date(expense.date_time), 'dd MMM yyyy HH:mm')}</td>
                          <td className="px-4 py-3">
                            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                              {expense.category ? toTitleCase(expense.category) : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{expense.description ? toTitleCase(expense.description) : 'N/A'}</td>
                          <td className="px-4 py-3 font-bold">₹{parseFloat(expense.amount).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                              {expense.payment_mode ? toTitleCase(expense.payment_mode) : 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
              )}
              </div>
            )}

            {/* Dip Entries Tab */}
            {activeDataTab === 'dip-entries' && (
              <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Dip Entries</h3>
            {dataLoading['dip-entries'] ? (
              <div className="text-center py-8">Loading dip entries...</div>
            ) : dipEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Droplets className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No dip entries found for this pump</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Date & Time</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Tank</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Shift</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Dip (cm)</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Calculated Liters</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dipEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{format(new Date(entry.date_time), 'dd MMM yyyy HH:mm')}</td>
                        <td className="px-4 py-3 font-medium">{entry.tank ? toTitleCase(entry.tank) : 'N/A'}</td>
                        <td className="px-4 py-3 font-medium">{entry.shift ? toTitleCase(entry.shift) : 'N/A'}</td>
                        <td className="px-4 py-3">{parseFloat(entry.dip_in_cm).toFixed(2)} cm</td>
                        <td className="px-4 py-3 font-medium">
                          {entry.calculated_liters ? `${parseFloat(entry.calculated_liters).toFixed(2)} L` : 'N/A'}
                        </td>
                        <td className="px-4 py-3">{entry.notes || 'N/A'}</td>
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
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Salary Entries</h3>
            {dataLoading['salary-entries'] ? (
              <div className="text-center py-8">Loading salary entries...</div>
            ) : salaryEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No salary entries found for this pump</p>
              </div>
            ) : (
              <>
                <div className="mb-4 bg-green-50 p-4 rounded-lg inline-block">
                  <p className="text-sm text-gray-600">Total Salary Paid</p>
                  <p className="text-2xl font-bold text-gray-800">
                    ₹{salaryEntries.reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Employee Name</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
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
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-1 rounded text-xs ${
                                entry.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {entry.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                entry.is_present ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {entry.is_present ? 'Present' : 'Absent'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">₹{parseFloat(entry.daily_wage || 0).toFixed(2)}</td>
                          <td className="px-4 py-3">₹{parseFloat(entry.bonus || 0).toFixed(2)}</td>
                          <td className="px-4 py-3">₹{parseFloat(entry.deduction || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 font-medium">₹{parseFloat(entry.total_amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

