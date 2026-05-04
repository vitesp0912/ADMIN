import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Building2, Phone, Mail, MapPin, User, Users, Calendar, DollarSign, CheckCircle, XCircle, Settings, Save, ShoppingCart, Gauge, Receipt, Package, BookOpen, Eye, Trash2, AlertTriangle, Fuel, ClipboardList, Plus } from 'lucide-react'
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
  const navigate = useNavigate()
  const [pump, setPump] = useState(null)
  const [users, setUsers] = useState([])
  const [sales, setSales] = useState([])
  const [meterReadings, setMeterReadings] = useState([])
  const [nozzles, setNozzles] = useState({})
  const [fuelTypes, setFuelTypes] = useState({})
  const [expenses, setExpenses] = useState([])
  const [dailyTesting, setDailyTesting] = useState([])
  const [inventory, setInventory] = useState([])
  const [customers, setCustomers] = useState([])
  const [udharLedger, setUdharLedger] = useState([])
  const [ledgerCustomers, setLedgerCustomers] = useState({})
  const [ledgerStaff, setLedgerStaff] = useState({})
  const [loading, setLoading] = useState(true)

  /** Udhar rows grouped by customer; each group sorted newest business date first. */
  const udharLedgerByCustomer = useMemo(() => {
    const byCustomer = new Map()
    for (const row of udharLedger) {
      const cid = row.customer_id
      if (!cid) continue
      if (!byCustomer.has(cid)) byCustomer.set(cid, [])
      byCustomer.get(cid).push(row)
    }

    const sortNewestFirst = (a, b) => {
      const da = a.business_date || ''
      const db = b.business_date || ''
      if (da !== db) return db.localeCompare(da)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }

    const groups = [...byCustomer.entries()].map(([customerId, rows]) => {
      const sortedRows = [...rows].sort(sortNewestFirst)
      const cust = ledgerCustomers[customerId]
      const sortKey = (cust?.name || cust?.phone || customerId).toString().toLowerCase()
      return { customerId, rows: sortedRows, cust, sortKey }
    })

    groups.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    return groups
  }, [udharLedger, ledgerCustomers])
  const [activeTab, setActiveTab] = useState('details')
  const [activeDataTab, setActiveDataTab] = useState('users')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [dataLoading, setDataLoading] = useState({})
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [modalPassword, setModalPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingPump, setDeletingPump] = useState(false)

  const [tanks, setTanks] = useState([])
  const [fuelReceipts, setFuelReceipts] = useState([])
  const [tankModalOpen, setTankModalOpen] = useState(false)
  const [tankForm, setTankForm] = useState({})
  const [tankSaving, setTankSaving] = useState(false)
  const [tankModalError, setTankModalError] = useState('')
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [receiptForm, setReceiptForm] = useState({})
  const [receiptSaving, setReceiptSaving] = useState(false)
  const [receiptModalError, setReceiptModalError] = useState('')
  const [fuelTypesDropdown, setFuelTypesDropdown] = useState([])

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

        case 'inventory':
          const { data: inventoryData, error: inventoryError } = await supabase
            .from('inventory')
            .select('*')
            .eq('pump_id', id)
            .order('created_at', { ascending: false })
            .limit(500)
          if (inventoryError) {
            console.error('Inventory fetch error:', inventoryError)
            throw inventoryError
          }
          setInventory(inventoryData || [])
          break

        case 'customers':
          const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('*')
            .eq('pump_id', id)
            .order('created_at', { ascending: false })
            .limit(500)
          if (customersError) {
            console.error('Customers fetch error:', customersError)
            throw customersError
          }
          setCustomers(customersData || [])
          break

        case 'udhar-ledger': {
          const { data: udharData, error: udharError } = await supabase
            .from('udhar_ledger')
            .select('*')
            .eq('pump_id', id)
            .order('created_at', { ascending: false })
            .limit(500)
          if (udharError) {
            console.error('Udhar ledger fetch error:', udharError)
            throw udharError
          }
          const rows = udharData || []
          setUdharLedger(rows)
          setLedgerCustomers({})
          setLedgerStaff({})
          const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))]
          const staffIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]
          const lookups = []
          if (custIds.length > 0) {
            lookups.push(
              supabase
                .from('customers')
                .select('id, name, phone')
                .in('id', custIds)
                .then(({ data: cRows, error: cErr }) => {
                  if (cErr) {
                    console.error('Ledger customers lookup:', cErr)
                    return
                  }
                  const m = {}
                  cRows?.forEach((c) => {
                    m[c.id] = c
                  })
                  setLedgerCustomers(m)
                })
            )
          }
          if (staffIds.length > 0) {
            lookups.push(
              supabase
                .from('users')
                .select('id, name')
                .in('id', staffIds)
                .then(({ data: uRows, error: uErr }) => {
                  if (uErr) {
                    console.error('Ledger staff lookup:', uErr)
                    return
                  }
                  const m = {}
                  uRows?.forEach((u) => {
                    m[u.id] = u
                  })
                  setLedgerStaff(m)
                })
            )
          }
          await Promise.all(lookups)
          break
        }

        case 'tanks': {
          const { data: tanksData, error: tanksErr } = await supabase
            .from('tanks')
            .select('*')
            .eq('pump_id', id)
            .order('name')
          if (tanksErr) {
            console.error('Tanks fetch error:', tanksErr)
            throw tanksErr
          }
          setTanks(tanksData || [])
          const ftIds = [...new Set((tanksData || []).map((t) => t.fuel_type).filter(Boolean))]
          if (ftIds.length > 0) {
            await fetchFuelTypes(ftIds)
          }
          break
        }

        case 'fuel-receipts': {
          const { data: frData, error: frErr } = await supabase
            .from('fuel_receipts')
            .select('*')
            .eq('pump_id', id)
            .order('date_time', { ascending: false })
            .limit(500)
          if (frErr) {
            console.error('Fuel receipts fetch error:', frErr)
            throw frErr
          }
          setFuelReceipts(frData || [])
          const { data: tanksForPump, error: tanksForPumpErr } = await supabase
            .from('tanks')
            .select('*')
            .eq('pump_id', id)
            .order('name')
          if (tanksForPumpErr) {
            console.error('Tanks (for receipts) fetch error:', tanksForPumpErr)
          }
          setTanks(tanksForPump || [])
          const fuelIdsFromReceipts = [...new Set((frData || []).map((r) => r.fuel_type_id).filter(Boolean))]
          const fuelIdsFromTanks = [...new Set((tanksForPump || []).map((t) => t.fuel_type).filter(Boolean))]
          const mergedFuelIds = [...new Set([...fuelIdsFromReceipts, ...fuelIdsFromTanks])]
          if (mergedFuelIds.length > 0) {
            await fetchFuelTypes(mergedFuelIds)
          }
          break
        }
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

  const fetchFuelTypesDropdown = async () => {
    try {
      const { data, error } = await supabase
        .from('fuel_types')
        .select('id, name, fuel_type, title')
        .order('name')
        .limit(500)
      if (error) {
        console.error('Error fetching fuel types list:', error)
        return
      }
      setFuelTypesDropdown(data || [])
      const map = {}
      data?.forEach((fuel) => {
        map[fuel.id] = fuel
      })
      setFuelTypes((prev) => ({ ...prev, ...map }))
    } catch (err) {
      console.error('Error fetching fuel types list:', err)
    }
  }

  const fuelTypeLabel = (ftId) => {
    const fuel = fuelTypes[ftId]
    return fuel?.name || fuel?.fuel_type || fuel?.title || ftId || 'N/A'
  }

  const openTankModal = (existing = null) => {
    setTankModalError('')
    fetchFuelTypesDropdown()
    if (existing) {
      setTankForm({
        id: existing.id,
        name: existing.name || '',
        capacity_liters: String(existing.capacity_liters ?? ''),
        fuel_type: existing.fuel_type || '',
        is_active: existing.is_active !== false,
        initial_volume_liters: String(existing.initial_volume_liters ?? '0'),
        initial_dip_cm: String(existing.initial_dip_cm ?? '0'),
        current_volume_liters: String(existing.current_volume_liters ?? '0'),
      })
    } else {
      setTankForm({
        id: '',
        name: '',
        capacity_liters: '',
        fuel_type: '',
        is_active: true,
        initial_volume_liters: '0',
        initial_dip_cm: '0',
        current_volume_liters: '0',
      })
    }
    setTankModalOpen(true)
  }

  const handleSaveTank = async () => {
    setTankSaving(true)
    setTankModalError('')
    try {
      const cap = parseFloat(tankForm.capacity_liters)
      const initVol = parseFloat(tankForm.initial_volume_liters || '0')
      const curVol = parseFloat(tankForm.current_volume_liters || '0')
      const dip = parseFloat(tankForm.initial_dip_cm || '0')
      if (!tankForm.name?.trim()) throw new Error('Name is required')
      if (!tankForm.fuel_type) throw new Error('Fuel type is required')
      if (Number.isNaN(cap) || cap <= 0) throw new Error('Capacity must be a positive number')
      if (Number.isNaN(initVol) || initVol < 0) throw new Error('Initial volume must be >= 0')
      if (Number.isNaN(curVol) || curVol < 0) throw new Error('Current volume must be >= 0')
      if (curVol > cap) throw new Error('Current volume cannot exceed capacity')
      if (Number.isNaN(dip) || dip < 0) throw new Error('Initial dip must be >= 0')

      const now = new Date().toISOString()
      if (tankForm.id) {
        const { error } = await supabase
          .from('tanks')
          .update({
            name: tankForm.name.trim(),
            capacity_liters: cap,
            fuel_type: tankForm.fuel_type,
            is_active: tankForm.is_active,
            initial_volume_liters: initVol,
            initial_dip_cm: dip,
            current_volume_liters: curVol,
            updated_at: now,
          })
          .eq('id', tankForm.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tanks').insert({
          pump_id: id,
          name: tankForm.name.trim(),
          capacity_liters: cap,
          fuel_type: tankForm.fuel_type,
          is_active: tankForm.is_active,
          initial_volume_liters: initVol,
          initial_dip_cm: dip,
          current_volume_liters: curVol,
          updated_at: now,
        })
        if (error) throw error
      }
      setTankModalOpen(false)
      await fetchTabData('tanks')
    } catch (e) {
      setTankModalError(e.message || 'Failed to save tank')
    } finally {
      setTankSaving(false)
    }
  }

  const openReceiptModal = async () => {
    setReceiptModalError('')
    await fetchFuelTypesDropdown()
    let list = tanks
    if (!list.length) {
      const { data } = await supabase.from('tanks').select('*').eq('pump_id', id).order('name')
      list = data || []
      setTanks(list)
    }
    const first = list[0]
    const today = new Date().toISOString().slice(0, 10)
    setReceiptForm({
      tank_id: first?.id || '',
      fuel_type_id: first?.fuel_type || '',
      receipt_date: today,
      quantity_liters: '',
      invoice_number: '',
      supplier_name: '',
      notes: '',
    })
    setReceiptModalOpen(true)
  }

  const handleReceiptTankChange = (tankId) => {
    const t = tanks.find((x) => x.id === tankId)
    setReceiptForm((f) => ({
      ...f,
      tank_id: tankId,
      fuel_type_id: t?.fuel_type || '',
    }))
  }

  const handleSaveReceipt = async () => {
    setReceiptSaving(true)
    setReceiptModalError('')
    try {
      const qty = parseFloat(receiptForm.quantity_liters)
      if (!receiptForm.tank_id) throw new Error('Select a tank')
      if (!receiptForm.fuel_type_id) throw new Error('Fuel type is missing (pick a tank)')
      if (Number.isNaN(qty) || qty <= 0) throw new Error('Quantity must be greater than 0')
      const { error } = await supabase.from('fuel_receipts').insert({
        pump_id: id,
        tank_id: receiptForm.tank_id,
        fuel_type_id: receiptForm.fuel_type_id,
        receipt_date: receiptForm.receipt_date || new Date().toISOString().slice(0, 10),
        quantity_liters: qty,
        invoice_number: receiptForm.invoice_number?.trim() || null,
        supplier_name: receiptForm.supplier_name?.trim() || null,
        notes: receiptForm.notes?.trim() || null,
        user_id: null,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setReceiptModalOpen(false)
      await fetchTabData('fuel-receipts')
    } catch (e) {
      setReceiptModalError(e.message || 'Failed to save receipt')
    } finally {
      setReceiptSaving(false)
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

  const openPasswordModal = () => {
    const defaultUser = users[0]?.id || ''
    setSelectedUserId(defaultUser)
    setModalPassword('')
    setShowPassword(false)
    setPasswordError('')
    setPasswordSuccess('')
    setPasswordModalOpen(true)
  }

  const closePasswordModal = () => {
    setPasswordModalOpen(false)
    setSelectedUserId('')
    setModalPassword('')
    setShowPassword(false)
    setPasswordError('')
    setPasswordSuccess('')
  }

  const handleSetUserPassword = async () => {
    if (!selectedUserId) {
      setPasswordError('Please select a user.')
      return
    }
    if (!modalPassword || modalPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }
    setPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')
    try {
      const { error } = await supabase.rpc('set_user_password', {
        p_user_id: selectedUserId,
        p_new_password: modalPassword,
      })
      if (error) throw error
      setPasswordSuccess('Password set successfully.')
      setModalPassword('')
    } catch (err) {
      setPasswordError(err.message || 'Failed to set password.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const openDeleteModal = () => {
    setDeleteConfirmText('')
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    if (deletingPump) return
    setDeleteModalOpen(false)
    setDeleteConfirmText('')
  }

  const deleteKeyword = `DELETE ${pump?.pump_code || pump?.name || ''}`.trim()

  const handleDeletePumpFromDetail = async () => {
    if (deleteConfirmText !== deleteKeyword) {
      setMessage({
        type: 'error',
        text: `Type "${deleteKeyword}" exactly to confirm deletion.`,
      })
      return
    }
    setDeletingPump(true)
    try {
      const { error } = await supabase.from('pumps').delete().eq('id', id)
      if (error) throw error
      navigate('/pumps')
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to delete pump. Please check related records and permissions.',
      })
      closeDeleteModal()
    } finally {
      setDeletingPump(false)
    }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6 lg:p-8">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{pump.name}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 className="w-4 h-4" />
              <span>Pump Code:</span>
              <span className="font-medium text-gray-700">{pump.pump_code || 'N/A'}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-4 lg:gap-6 xl:gap-8 items-start">
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
            <div className="border-b border-gray-200 bg-white overflow-x-auto">
              <nav className="flex px-3 sm:px-6 min-w-max">
                {[
                  { id: 'users', label: 'Users' },
                  { id: 'inventory', label: 'Inventory' },
                  { id: 'customers', label: 'Customers' },
                  { id: 'udhar-ledger', label: 'Udhar ledger' },
                  { id: 'sales', label: 'Digital Sales' },
                  { id: 'meter-readings', label: 'Meter Readings' },
                  { id: 'expenses', label: 'Expenses' },
                  { id: 'daily-testing', label: 'Daily Testing' },
                  { id: 'tanks', label: 'Tanks' },
                  { id: 'fuel-receipts', label: 'Fuel receipts' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveDataTab(tab.id)
                      fetchTabData(tab.id)
                    }}
                    className={`py-3 px-3 sm:px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
            <div className="p-4 sm:p-6">

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

            {/* Inventory Tab */}
            {activeDataTab === 'inventory' && (
              <div>
                {dataLoading['inventory'] ? (
                  <div className="text-center py-8">Loading inventory...</div>
                ) : inventory.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No inventory items for this pump</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-600" />
                      Stock ({inventory.length})
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Qty</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Cost</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Selling</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Expiry</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Batch</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Added</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {inventory.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                              <td className="px-4 py-3">{row.quantity}</td>
                              <td className="px-4 py-3">₹{parseFloat(row.cost_price).toFixed(2)}</td>
                              <td className="px-4 py-3">
                                {row.selling_price != null
                                  ? `₹${parseFloat(row.selling_price).toFixed(2)}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3">
                                {row.expiry_date
                                  ? format(new Date(row.expiry_date + 'T12:00:00'), 'dd MMM yyyy')
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{row.batch_number || '—'}</td>
                              <td className="px-4 py-3 text-gray-500">
                                {row.created_at
                                  ? format(new Date(row.created_at), 'dd MMM yyyy HH:mm')
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Customers Tab */}
            {activeDataTab === 'customers' && (
              <div>
                {dataLoading['customers'] ? (
                  <div className="text-center py-8">Loading customers...</div>
                ) : customers.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No customers for this pump</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-sky-600" />
                      Customers ({customers.length})
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Phone</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Created</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Updated</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {customers.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                              <td className="px-4 py-3 font-mono text-gray-800">{row.phone}</td>
                              <td className="px-4 py-3 text-gray-500">
                                {row.created_at
                                  ? format(new Date(row.created_at), 'dd MMM yyyy HH:mm')
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {row.updated_at
                                  ? format(new Date(row.updated_at), 'dd MMM yyyy HH:mm')
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Udhar ledger Tab */}
            {activeDataTab === 'udhar-ledger' && (
              <div>
                {dataLoading['udhar-ledger'] ? (
                  <div className="text-center py-8">Loading transactions...</div>
                ) : udharLedger.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No udhar / credit transactions for this pump</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <BookOpen className="w-5 h-5 text-violet-600 shrink-0" />
                      <span>
                        Transactions ({udharLedger.length})
                        <span className="font-normal text-gray-500 text-base font-medium">
                          {' '}
                          · {udharLedgerByCustomer.length} customer
                          {udharLedgerByCustomer.length !== 1 ? 's' : ''}
                        </span>
                      </span>
                    </h3>
                    {udharLedgerByCustomer.map(({ customerId, rows, cust }) => (
                      <div
                        key={customerId}
                        className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm"
                      >
                        <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-gray-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Users className="w-4 h-4 text-violet-600 shrink-0" />
                          <span className="font-semibold text-gray-900">
                            {cust?.name || 'Unknown customer'}
                          </span>
                          {cust?.phone && (
                            <span className="text-sm font-mono text-gray-600">{cust.phone}</span>
                          )}
                          <span className="text-xs text-gray-500 ml-auto">
                            {rows.length} transaction{rows.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">
                                  Business date
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">
                                  Recorded by
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Vehicle</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Note</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Created</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {rows.map((row) => {
                                const staff = ledgerStaff[row.user_id]
                                const isCredit = row.entry_type === 'credit'
                                return (
                                  <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {row.business_date
                                        ? format(
                                            new Date(row.business_date + 'T12:00:00'),
                                            'dd MMM yyyy'
                                          )
                                        : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                                          isCredit
                                            ? 'bg-amber-100 text-amber-900'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                      >
                                        {row.entry_type
                                          ? toTitleCase(row.entry_type)
                                          : '—'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-semibold">
                                      ₹{parseFloat(row.amount).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-800">{staff?.name || '—'}</td>
                                    <td className="px-4 py-3 font-mono text-gray-700">
                                      {row.vehicle_number || '—'}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 max-w-[180px] truncate"
                                      title={row.note || ''}
                                    >
                                      {row.note || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                      {row.created_at
                                        ? format(new Date(row.created_at), 'dd MMM yyyy HH:mm')
                                        : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
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

            {/* Tanks Tab */}
            {activeDataTab === 'tanks' && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Fuel className="w-5 h-5 text-amber-600" />
                    Tanks ({tanks.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => openTankModal(null)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add tank
                  </button>
                </div>
                {dataLoading.tanks ? (
                  <div className="text-center py-8">Loading tanks...</div>
                ) : tanks.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Fuel className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No tanks configured for this pump</p>
                    <button
                      type="button"
                      onClick={() => openTankModal(null)}
                      className="mt-4 text-amber-700 font-medium hover:underline"
                    >
                      Add your first tank
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Fuel</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Capacity (L)</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Current (L)</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Initial (L)</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Dip (cm)</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Active</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700"> </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {tanks.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                            <td className="px-4 py-3">{fuelTypeLabel(t.fuel_type)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{parseFloat(t.capacity_liters || 0).toFixed(3)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{parseFloat(t.current_volume_liters || 0).toFixed(3)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{parseFloat(t.initial_volume_liters || 0).toFixed(3)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{parseFloat(t.initial_dip_cm || 0).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              {t.is_active ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">No</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => openTankModal(t)}
                                className="text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Fuel receipts Tab */}
            {activeDataTab === 'fuel-receipts' && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-teal-600" />
                    Fuel receipts ({fuelReceipts.length})
                  </h3>
                  <button
                    type="button"
                    onClick={openReceiptModal}
                    disabled={!tanks.length && !dataLoading['fuel-receipts']}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Add receipt
                  </button>
                </div>
                {dataLoading['fuel-receipts'] ? (
                  <div className="text-center py-8">Loading fuel receipts...</div>
                ) : fuelReceipts.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No fuel receipts for this pump</p>
                    {tanks.length === 0 ? (
                      <p className="text-sm text-amber-700 mt-2">Add a tank first, then record a delivery.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={openReceiptModal}
                        className="mt-4 text-teal-700 font-medium hover:underline"
                      >
                        Add a receipt
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Receipt date</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Recorded</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Tank</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Fuel</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Qty (L)</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Invoice</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Supplier</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {fuelReceipts.map((r) => {
                          const tankRow = tanks.find((x) => x.id === r.tank_id)
                          return (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap">
                                {r.receipt_date
                                  ? format(new Date(r.receipt_date + 'T12:00:00'), 'dd MMM yyyy')
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                {r.date_time ? format(new Date(r.date_time), 'dd MMM yyyy HH:mm') : '—'}
                              </td>
                              <td className="px-4 py-3 font-medium">{tankRow?.name || r.tank_id || '—'}</td>
                              <td className="px-4 py-3">{fuelTypeLabel(r.fuel_type_id)}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium">
                                {parseFloat(r.quantity_liters || 0).toFixed(3)}
                              </td>
                              <td className="px-4 py-3 max-w-[140px] truncate" title={r.invoice_number || ''}>
                                {r.invoice_number || '—'}
                              </td>
                              <td className="px-4 py-3 max-w-[140px] truncate" title={r.supplier_name || ''}>
                                {r.supplier_name || '—'}
                              </td>
                              <td className="px-4 py-3 max-w-[180px] truncate text-gray-600" title={r.notes || ''}>
                                {r.notes || '—'}
                              </td>
                            </tr>
                          )
                        })}
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
        <div className="w-full xl:sticky xl:top-6 space-y-4 sm:space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Section Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                Pump Information
              </h2>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200 bg-white overflow-x-auto">
              <nav className="flex px-3 sm:px-6 min-w-max">
                {[
                  { id: 'details', label: 'Details' },
                  { id: 'subscription', label: 'Subscription' },
                  { id: 'management', label: 'Management' },
                  { id: 'actions', label: 'Actions' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 px-3 sm:px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
            <div className="p-4 sm:p-6">

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

              {/* Actions Tab */}
              {activeTab === 'actions' && (
              <div className="space-y-4">
                <div className="p-4 border border-gray-200 rounded-lg bg-white">
                  <h3 className="font-semibold text-gray-900 mb-2">User Password Actions</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Set/reset password for users linked to this pump.
                  </p>
                  <button
                    onClick={openPasswordModal}
                    disabled={users.length === 0}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Set / View Password
                  </button>
                  {users.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">No users found for this pump.</p>
                  )}
                </div>

                <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Danger Zone
                  </h3>
                  <p className="text-sm text-red-700 mb-4">
                    Deleting this pump is permanent and can remove related records.
                  </p>
                  <button
                    onClick={openDeleteModal}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Pump
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {passwordModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl"
            onClick={closePasswordModal}
            aria-label="Close"
          >
            ×
          </button>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Set User Password</h3>

          <label className="text-sm font-medium text-gray-700 mb-1 block">User</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
            disabled={passwordLoading}
          >
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name || 'Unnamed')} ({u.phone || 'No phone'})
              </option>
            ))}
          </select>

          <label className="text-sm font-medium text-gray-700 mb-1 block">New Password</label>
          <div className="relative mb-3">
            <input
              type={showPassword ? 'text' : 'password'}
              value={modalPassword}
              onChange={(e) => setModalPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg pr-10"
              placeholder="At least 8 characters"
              disabled={passwordLoading}
            />
            <button
              type="button"
              className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowPassword((s) => !s)}
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>

          {passwordError && <p className="text-sm text-red-600 mb-2">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-green-600 mb-2">{passwordSuccess}</p>}

          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={closePasswordModal}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700"
              disabled={passwordLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSetUserPassword}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={passwordLoading}
            >
              {passwordLoading ? 'Saving...' : 'Set Password'}
            </button>
          </div>
        </div>
      </div>
    )}

    {deleteModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-5 relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl"
            onClick={closeDeleteModal}
            aria-label="Close"
          >
            ×
          </button>
          <h3 className="text-lg font-semibold text-red-700 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Confirm Pump Deletion
          </h3>
          <p className="text-sm text-gray-700 mb-3">
            You are about to permanently delete this pump and associated records (based on DB cascade rules).
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1 mb-4">
            <p><span className="font-medium">Pump Code:</span> {pump.pump_code || 'N/A'}</p>
            <p><span className="font-medium">Name:</span> {pump.name || 'N/A'}</p>
            <p><span className="font-medium">Owner:</span> {pump.owner_name || 'N/A'}</p>
            <p><span className="font-medium">Owner Phone:</span> {pump.owner_phone || 'N/A'}</p>
            <p><span className="font-medium">Pump Phone:</span> {pump.phone || 'N/A'}</p>
            <p><span className="font-medium">Address:</span> {pump.address || 'N/A'}</p>
            <p><span className="font-medium">City/State:</span> {pump.city || '-'} / {pump.state || '-'}</p>
            <p><span className="font-medium">PIN:</span> {pump.pincode || 'N/A'}</p>
            <p><span className="font-medium">Status:</span> {pump.is_active ? 'Active' : 'Inactive'} | {pump.registration_status || 'N/A'}</p>
            <p><span className="font-medium">Created:</span> {pump.created_at ? new Date(pump.created_at).toLocaleString() : 'N/A'}</p>
          </div>

          <p className="text-sm text-red-700 mb-2">
            Type <span className="font-semibold">{deleteKeyword}</span> to confirm:
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            className="w-full px-3 py-2 border border-red-300 rounded-lg mb-4"
            placeholder={deleteKeyword}
            disabled={deletingPump}
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={closeDeleteModal}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700"
              disabled={deletingPump}
            >
              Cancel
            </button>
            <button
              onClick={handleDeletePumpFromDetail}
              className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              disabled={deletingPump || deleteConfirmText !== deleteKeyword}
            >
              {deletingPump ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </div>
    )}

    {tankModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 relative my-8">
          <button
            type="button"
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl"
            onClick={() => !tankSaving && setTankModalOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-amber-600" />
            {tankForm.id ? 'Edit tank' : 'Add tank'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
              <input
                type="text"
                value={tankForm.name || ''}
                onChange={(e) => setTankForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={tankSaving}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fuel type</label>
              <select
                value={tankForm.fuel_type || ''}
                onChange={(e) => setTankForm((f) => ({ ...f, fuel_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={tankSaving}
              >
                <option value="">Select fuel type</option>
                {fuelTypesDropdown.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name || ft.fuel_type || ft.title || ft.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Capacity (L)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={tankForm.capacity_liters ?? ''}
                  onChange={(e) => setTankForm((f) => ({ ...f, capacity_liters: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={tankSaving}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Current volume (L)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={tankForm.current_volume_liters ?? ''}
                  onChange={(e) => setTankForm((f) => ({ ...f, current_volume_liters: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={tankSaving}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Initial volume (L)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={tankForm.initial_volume_liters ?? ''}
                  onChange={(e) => setTankForm((f) => ({ ...f, initial_volume_liters: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={tankSaving}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Initial dip (cm)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tankForm.initial_dip_cm ?? ''}
                  onChange={(e) => setTankForm((f) => ({ ...f, initial_dip_cm: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={tankSaving}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!tankForm.is_active}
                onChange={(e) => setTankForm((f) => ({ ...f, is_active: e.target.checked }))}
                disabled={tankSaving}
              />
              Active
            </label>
            {tankModalError && <p className="text-sm text-red-600">{tankModalError}</p>}
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => !tankSaving && setTankModalOpen(false)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700"
              disabled={tankSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTank}
              className="px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              disabled={tankSaving}
            >
              {tankSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )}

    {receiptModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 relative my-8">
          <button
            type="button"
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl"
            onClick={() => !receiptSaving && setReceiptModalOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-teal-600" />
            Add fuel receipt
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tank</label>
              <select
                value={receiptForm.tank_id || ''}
                onChange={(e) => handleReceiptTankChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={receiptSaving}
              >
                <option value="">Select tank</option>
                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({fuelTypeLabel(t.fuel_type)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Receipt date</label>
              <input
                type="date"
                value={receiptForm.receipt_date || ''}
                onChange={(e) => setReceiptForm((f) => ({ ...f, receipt_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={receiptSaving}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Quantity (L)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={receiptForm.quantity_liters ?? ''}
                onChange={(e) => setReceiptForm((f) => ({ ...f, quantity_liters: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={receiptSaving}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Invoice #</label>
              <input
                type="text"
                value={receiptForm.invoice_number || ''}
                onChange={(e) => setReceiptForm((f) => ({ ...f, invoice_number: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={receiptSaving}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Supplier</label>
              <input
                type="text"
                value={receiptForm.supplier_name || ''}
                onChange={(e) => setReceiptForm((f) => ({ ...f, supplier_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={receiptSaving}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
              <textarea
                value={receiptForm.notes || ''}
                onChange={(e) => setReceiptForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
                disabled={receiptSaving}
              />
            </div>
            {receiptModalError && <p className="text-sm text-red-600">{receiptModalError}</p>}
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => !receiptSaving && setReceiptModalOpen(false)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700"
              disabled={receiptSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveReceipt}
              className="px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              disabled={receiptSaving || !tanks.length}
            >
              {receiptSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
