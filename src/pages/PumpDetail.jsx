import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Building2, Phone, Mail, MapPin, User, Users, Calendar, DollarSign, CheckCircle, XCircle, Settings, Save, ShoppingCart, Gauge, Receipt, Package, BookOpen, Eye, Trash2, AlertTriangle, Fuel, ClipboardList, FileText, AlertCircle, Clock, StickyNote, Pencil, Plus, X, Wallet, ArrowLeftRight } from 'lucide-react'
import { formatISTDate, formatISTDateTime, formatISTRelativeTime, phoneToTel } from '../lib/datetime'

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

const emptyNoteForm = {
  id: null,
  body: '',
}

const BUCKET_TYPE_LABELS = {
  IN_HAND_CASH: 'In-hand cash',
  CURRENT_ACCOUNT: 'Current account',
  COMPANY_ACCOUNT: 'Company account',
}

const formatInr = (value) => {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const authorDisplayName = (user) => {
  if (!user) return null
  const meta = user.user_metadata || {}
  const name =
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
    null
  if (name && String(name).trim()) return String(name).trim()
  if (user.email) return user.email.split('@')[0]
  return null
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
  const [inventory, setInventory] = useState([])
  const [customers, setCustomers] = useState([])
  const [udharLedger, setUdharLedger] = useState([])
  const [ledgerCustomers, setLedgerCustomers] = useState({})
  const [ledgerStaff, setLedgerStaff] = useState({})
  const [loading, setLoading] = useState(true)
  const [treasuryBuckets, setTreasuryBuckets] = useState([])
  const [treasuryLedger, setTreasuryLedger] = useState([])

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

  const treasuryBucketById = useMemo(() => {
    const map = {}
    treasuryBuckets.forEach((b) => {
      map[b.id] = b
    })
    return map
  }, [treasuryBuckets])

  const treasuryBucketsTotal = useMemo(
    () => treasuryBuckets.reduce((sum, b) => sum + parseFloat(b.current_balance || 0), 0),
    [treasuryBuckets]
  )

  const treasuryLedgerByBucket = useMemo(() => {
    const groups = new Map()

    const ensureGroup = (bucketId) => {
      if (!bucketId) return null
      if (!groups.has(bucketId)) {
        const bucket = treasuryBucketById[bucketId] || {
          id: bucketId,
          name: 'Unknown bucket',
          bucket_type: '',
          display_order: 9999,
        }
        groups.set(bucketId, { bucket, transactions: [] })
      }
      return groups.get(bucketId)
    }

    treasuryLedger.forEach((tx) => {
      if (tx.from_bucket_id) {
        ensureGroup(tx.from_bucket_id)?.transactions.push({ tx, direction: 'out' })
      }
      if (tx.to_bucket_id) {
        ensureGroup(tx.to_bucket_id)?.transactions.push({ tx, direction: 'in' })
      }
    })

    groups.forEach((group) => {
      group.transactions.sort((a, b) => {
        const dateCmp = String(b.tx.business_date).localeCompare(String(a.tx.business_date))
        if (dateCmp !== 0) return dateCmp
        return String(b.tx.created_at).localeCompare(String(a.tx.created_at))
      })
    })

    const bucketOrder = new Map(
      treasuryBuckets.map((b, index) => [b.id, b.display_order ?? index])
    )

    return [...groups.values()]
      .filter((group) => group.transactions.length > 0)
      .sort((a, b) => {
        const orderA = bucketOrder.get(a.bucket.id) ?? a.bucket.display_order ?? 9999
        const orderB = bucketOrder.get(b.bucket.id) ?? b.bucket.display_order ?? 9999
        if (orderA !== orderB) return orderA - orderB
        return (a.bucket.name || '').localeCompare(b.bucket.name || '')
      })
  }, [treasuryLedger, treasuryBuckets, treasuryBucketById])

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
  const [isSupportAdmin, setIsSupportAdmin] = useState(false)

  const [tanks, setTanks] = useState([])
  const [fuelReceipts, setFuelReceipts] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLogsTotal, setAuditLogsTotal] = useState(0)
  const [errorLogs, setErrorLogs] = useState([])
  const [pumpNotes, setPumpNotes] = useState([])
  const [noteForm, setNoteForm] = useState(emptyNoteForm)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteDeletingId, setNoteDeletingId] = useState(null)
  const [noteFormError, setNoteFormError] = useState('')
  const [noteFormOpen, setNoteFormOpen] = useState(false)

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
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      const email = (user?.email || '').trim().toLowerCase()
      setIsSupportAdmin(email === 'support@petrofi.com')
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

        case 'notes': {
          const { data: notesData, error: notesErr } = await supabase
            .from('pump_notes')
            .select('*')
            .eq('pump_id', id)
            .order('created_at', { ascending: false })
            .limit(500)
          if (notesErr) {
            console.error('Pump notes fetch error:', notesErr)
            throw notesErr
          }
          setPumpNotes(notesData || [])
          break
        }

        case 'bank-accounts': {
          const { data, error } = await supabase
            .from('treasury_buckets')
            .select('*')
            .eq('pump_id', id)
            .order('display_order', { ascending: true })
            .order('name', { ascending: true })
          if (error) {
            console.error('Treasury buckets fetch error:', error)
            throw error
          }
          setTreasuryBuckets(data || [])
          break
        }

        case 'treasury-transactions': {
          const [bucketsRes, ledgerRes] = await Promise.all([
            supabase
              .from('treasury_buckets')
              .select('*')
              .eq('pump_id', id)
              .order('display_order', { ascending: true }),
            supabase
              .from('treasury_ledger')
              .select('*')
              .eq('pump_id', id)
              .is('deleted_at', null)
              .order('business_date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(500),
          ])
          if (bucketsRes.error) {
            console.error('Treasury buckets (for ledger) fetch error:', bucketsRes.error)
            throw bucketsRes.error
          }
          if (ledgerRes.error) {
            console.error('Treasury ledger fetch error:', ledgerRes.error)
            throw ledgerRes.error
          }
          setTreasuryBuckets(bucketsRes.data || [])
          setTreasuryLedger(ledgerRes.data || [])
          break
        }

        case 'activity': {
          const [{ data: logData, error: logErr }, { data: countData, error: countErr }] = await Promise.all([
            supabase.rpc('get_audit_logs', {
              p_pump_id: id,
              p_limit: 100,
              p_offset: 0,
            }),
            supabase.rpc('get_audit_logs_count', { p_pump_id: id }),
          ])
          if (logErr) {
            console.error('Activity fetch error:', logErr)
            throw logErr
          }
          if (countErr) console.error('Activity count error:', countErr)
          setAuditLogs(logData || [])
          setAuditLogsTotal(typeof countData === 'number' ? countData : (countData ?? 0))
          break
        }

        case 'error-logs': {
          const { data: errData, error: errLogErr } = await supabase
            .from('error_audits')
            .select('*')
            .eq('pump_id', id)
            .order('created_at', { ascending: false })
            .limit(200)
          if (errLogErr) {
            console.error('Error logs fetch error:', errLogErr)
            throw errLogErr
          }
          setErrorLogs(errData || [])
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

  const fuelTypeLabel = (ftId) => {
    const fuel = fuelTypes[ftId]
    return fuel?.name || fuel?.fuel_type || fuel?.title || ftId || 'N/A'
  }

  const resetNoteForm = () => {
    setNoteForm(emptyNoteForm)
    setNoteFormError('')
    setNoteFormOpen(false)
  }

  const openNoteForm = () => {
    setNoteForm(emptyNoteForm)
    setNoteFormError('')
    setNoteFormOpen(true)
  }

  const startEditNote = (note) => {
    setNoteForm({
      id: note.id,
      body: note.body || '',
    })
    setNoteFormError('')
    setNoteFormOpen(true)
  }

  const handleSaveNote = async () => {
    const body = noteForm.body?.trim()
    if (!body) {
      setNoteFormError('Write a note before saving.')
      return
    }

    setNoteSaving(true)
    setNoteFormError('')
    try {
      const followUpIso = new Date().toISOString()
      const { data: { user } } = await supabase.auth.getUser()
      const authorName = authorDisplayName(user)

      if (noteForm.id) {
        const { error } = await supabase
          .from('pump_notes')
          .update({
            body,
            note_type: 'follow_up',
            follow_up_at: followUpIso,
            ...(authorName ? { author_name: authorName } : {}),
          })
          .eq('id', noteForm.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('pump_notes').insert({
          pump_id: id,
          body,
          note_type: 'follow_up',
          follow_up_at: followUpIso,
          ...(authorName ? { author_name: authorName } : {}),
        })
        if (error) throw error
      }

      resetNoteForm()
      await fetchTabData('notes')
    } catch (e) {
      setNoteFormError(e.message || 'Failed to save note')
    } finally {
      setNoteSaving(false)
    }
  }

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return
    setNoteDeletingId(noteId)
    try {
      const { error } = await supabase.from('pump_notes').delete().eq('id', noteId)
      if (error) throw error
      if (noteForm.id === noteId) resetNoteForm()
      await fetchTabData('notes')
    } catch (e) {
      setNoteFormError(e.message || 'Failed to delete note')
    } finally {
      setNoteDeletingId(null)
    }
  }

  const handleSaveChanges = async (overrideFormData = null) => {
    setSaving(true)
    setMessage({ type: '', text: '' })
    
    try {
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error('You must be logged in to update pump details. Please refresh the page and login again.')
      }
      
      console.log('Current user:', user.email || user.id)

      const dataToSave = overrideFormData || formData
      
      const updateData = {
        is_active: dataToSave.is_active,
        registration_status: dataToSave.registration_status,
        payment_verified: dataToSave.payment_verified,
        subscription_status: dataToSave.subscription_status,
        subscription_plan: dataToSave.subscription_plan,
        billing_cycle: dataToSave.billing_cycle,
        updated_at: new Date().toISOString(),
      }

      // Set payment verification details if being verified
      if (dataToSave.payment_verified && !pump.payment_verified) {
        updateData.payment_verified_at = new Date().toISOString()
        updateData.payment_verified_by = user?.id || null
      }

      // Set subscription dates
      if (dataToSave.subscription_start_date) {
        updateData.subscription_start_date = new Date(dataToSave.subscription_start_date).toISOString()
      }
      if (dataToSave.subscription_end_date) {
        updateData.subscription_end_date = new Date(dataToSave.subscription_end_date).toISOString()
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

      // Keep local form in sync with what was saved
      if (overrideFormData) {
        setFormData(overrideFormData)
      }

      // Activate users when pump is approved or activated
      const shouldActivateUsers = 
        (dataToSave.registration_status === 'approved' && pump.registration_status !== 'approved') ||
        (dataToSave.is_active === true && pump.is_active === false)

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
    const approvedFormData = {
      ...formData,
      is_active: true,
      registration_status: 'approved',
      payment_verified: true,
      subscription_status: 'active',
      subscription_start_date: formData.subscription_start_date || new Date().toISOString().split('T')[0],
    }

    setFormData(approvedFormData)
    await handleSaveChanges(approvedFormData)
  }

  const openPasswordModal = () => {
    if (!isSupportAdmin) {
      setMessage({
        type: 'error',
        text: 'Only support@petrofi.com can set or view user passwords.',
      })
      return
    }
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
    if (!isSupportAdmin) {
      setPasswordError('Only support@petrofi.com can set or view user passwords.')
      return
    }
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
      const { data: { user } } = await supabase.auth.getUser()
      const email = (user?.email || '').trim().toLowerCase()
      if (email !== 'support@petrofi.com') {
        throw new Error('Only support@petrofi.com can set or view user passwords.')
      }
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
    if (!isSupportAdmin) {
      setMessage({
        type: 'error',
        text: 'Only support@petrofi.com can delete petrol pumps.',
      })
      return
    }
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
    if (!isSupportAdmin) {
      setMessage({
        type: 'error',
        text: 'Only support@petrofi.com can delete petrol pumps.',
      })
      closeDeleteModal()
      return
    }
    if (deleteConfirmText !== deleteKeyword) {
      setMessage({
        type: 'error',
        text: `Type "${deleteKeyword}" exactly to confirm deletion.`,
      })
      return
    }
    setDeletingPump(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = (user?.email || '').trim().toLowerCase()
      if (email !== 'support@petrofi.com') {
        throw new Error('Only support@petrofi.com can delete petrol pumps.')
      }
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
            {phoneToTel(pump.phone) && (
              <a
                href={`tel:${phoneToTel(pump.phone)}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors"
                title={`Call ${pump.phone}`}
              >
                <Phone className="w-4 h-4" />
                Call pump
              </a>
            )}
            {phoneToTel(pump.owner_phone) && pump.owner_phone !== pump.phone && (
              <a
                href={`tel:${phoneToTel(pump.owner_phone)}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 transition-colors"
                title={`Call owner ${pump.owner_phone}`}
              >
                <Phone className="w-4 h-4" />
                Call owner
              </a>
            )}
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
                  { id: 'tanks', label: 'Tanks' },
                  { id: 'fuel-receipts', label: 'Fuel receipts' },
                  { id: 'bank-accounts', label: 'Bank accounts' },
                  { id: 'treasury-transactions', label: 'Transactions' },
                  { id: 'notes', label: 'Notes' },
                  { id: 'activity', label: 'Activity' },
                  { id: 'error-logs', label: 'Error logs' },
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
                                ? formatISTDateTime(user.last_login_at)
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
                                  ? formatISTDate(row.expiry_date)
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{row.batch_number || '—'}</td>
                              <td className="px-4 py-3 text-gray-500">
                                {row.created_at
                                  ? formatISTDateTime(row.created_at)
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
                                  ? formatISTDateTime(row.created_at)
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {row.updated_at
                                  ? formatISTDateTime(row.updated_at)
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
                                      {row.business_date ? formatISTDate(row.business_date) : '—'}
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
                                        ? formatISTDateTime(row.created_at)
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
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Date & Time (IST)</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{formatISTDateTime(sale.date_time)}</td>
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
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Testing (L)</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">RSP Applied</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">RO Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {meterReadings.map((reading) => (
                          <tr key={reading.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{formatISTDate(reading.date)}</td>
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
                            <td className="px-4 py-3 font-bold">{reading.sales != null ? parseFloat(reading.sales).toFixed(2) : '—'}</td>
                            <td className="px-4 py-3 font-medium tabular-nums">
                              {parseFloat(reading.testing_amount_liters || 0).toFixed(3)}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {reading.rsp_applied != null ? `₹${parseFloat(reading.rsp_applied).toFixed(3)}` : '—'}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {reading.ro_price_applied != null ? `₹${parseFloat(reading.ro_price_applied).toFixed(3)}` : '—'}
                            </td>
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
                            <td className="px-4 py-3">{formatISTDateTime(expense.date_time)}</td>
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

            {/* Tanks Tab */}
            {activeDataTab === 'tanks' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <Fuel className="w-5 h-5 text-amber-600" />
                  Tanks ({tanks.length})
                </h3>
                <p className="text-sm text-gray-500 mb-4">View only — tanks are not editable from this admin panel.</p>
                {dataLoading.tanks ? (
                  <div className="text-center py-8">Loading tanks...</div>
                ) : tanks.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Fuel className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No tanks configured for this pump</p>
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
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Active</th>
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
                            <td className="px-4 py-3">
                              {t.is_active ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Fuel receipts Tab (read-only) */}
            {activeDataTab === 'fuel-receipts' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-teal-600" />
                  Fuel receipts ({fuelReceipts.length})
                </h3>
                <p className="text-sm text-gray-500 mb-4">View only — receipts are not editable from this admin panel.</p>
                {dataLoading['fuel-receipts'] ? (
                  <div className="text-center py-8">Loading fuel receipts...</div>
                ) : fuelReceipts.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No fuel receipts for this pump</p>
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
                                {formatISTDate(r.receipt_date)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                {r.date_time ? formatISTDateTime(r.date_time) : '—'}
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

            {/* Bank accounts Tab */}
            {activeDataTab === 'bank-accounts' && (
              <div className="min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-600 shrink-0" />
                    Bank accounts & buckets ({treasuryBuckets.length})
                  </h3>
                  {treasuryBuckets.length > 0 && (
                    <p className="text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg">
                      Total balance: {formatInr(treasuryBucketsTotal)}
                    </p>
                  )}
                </div>
                {dataLoading['bank-accounts'] ? (
                  <div className="text-center py-8">Loading bank accounts...</div>
                ) : treasuryBuckets.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No treasury buckets for this pump</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5 lg:hidden">
                      {treasuryBuckets.map((bucket) => (
                        <article
                          key={bucket.id}
                          className={`rounded-xl border p-4 shadow-sm ${
                            bucket.bucket_type === 'IN_HAND_CASH'
                              ? 'border-amber-200 bg-amber-50/40'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 text-sm">{bucket.name}</h4>
                            {!bucket.is_active && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Inactive</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-3">
                            {BUCKET_TYPE_LABELS[bucket.bucket_type] || toTitleCase(bucket.bucket_type)}
                          </p>
                          <p className="text-lg font-bold text-emerald-800 tabular-nums">{formatInr(bucket.current_balance)}</p>
                          {(bucket.bank_name || bucket.company_name) && (
                            <p className="text-xs text-gray-600 mt-2 truncate">
                              {[bucket.bank_name, bucket.company_name].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {bucket.account_number_last_four && (
                            <p className="text-xs text-gray-500 mt-1">···· {bucket.account_number_last_four}</p>
                          )}
                        </article>
                      ))}
                    </div>
                    <div className="hidden lg:block overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Bank</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Company</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Account</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-700">Current balance</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {treasuryBuckets.map((bucket) => (
                            <tr
                              key={bucket.id}
                              className={`hover:bg-gray-50 ${
                                bucket.bucket_type === 'IN_HAND_CASH' ? 'bg-amber-50/30' : ''
                              }`}
                            >
                              <td className="px-4 py-3 font-medium text-gray-900">{bucket.name}</td>
                              <td className="px-4 py-3">
                                {BUCKET_TYPE_LABELS[bucket.bucket_type] || toTitleCase(bucket.bucket_type)}
                              </td>
                              <td className="px-4 py-3">{bucket.bank_name || '—'}</td>
                              <td className="px-4 py-3">{bucket.company_name || '—'}</td>
                              <td className="px-4 py-3 tabular-nums">
                                {bucket.account_number_last_four ? `···· ${bucket.account_number_last_four}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-800 tabular-nums">
                                {formatInr(bucket.current_balance)}
                              </td>
                              <td className="px-4 py-3">
                                {bucket.is_active ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Active</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Inactive</span>
                                )}
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

            {/* Treasury transactions Tab */}
            {activeDataTab === 'treasury-transactions' && (
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <ArrowLeftRight className="w-5 h-5 text-sky-600 shrink-0" />
                  Transactions ({treasuryLedger.length})
                </h3>
                {dataLoading['treasury-transactions'] ? (
                  <div className="text-center py-8">Loading transactions...</div>
                ) : treasuryLedger.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No transactions for this pump</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {treasuryLedgerByBucket.map(({ bucket, transactions }) => (
                      <section
                        key={bucket.id}
                        className={`rounded-xl border overflow-hidden ${
                          bucket.bucket_type === 'IN_HAND_CASH'
                            ? 'border-amber-200 bg-amber-50/20'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50/80">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">{bucket.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {BUCKET_TYPE_LABELS[bucket.bucket_type] || (bucket.bucket_type ? toTitleCase(bucket.bucket_type) : 'Bucket')}
                              {' · '}
                              {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
                            </p>
                          </div>
                          {bucket.current_balance != null && (
                            <p className="text-sm font-bold text-emerald-800 tabular-nums shrink-0">
                              Balance: {formatInr(bucket.current_balance)}
                            </p>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-white border-b border-gray-100">
                              <tr>
                                <th className="px-3 sm:px-4 py-2.5 text-left font-medium text-gray-700">Date</th>
                                <th className="px-3 sm:px-4 py-2.5 text-left font-medium text-gray-700">Type</th>
                                <th className="px-3 sm:px-4 py-2.5 text-left font-medium text-gray-700">Flow</th>
                                <th className="px-3 sm:px-4 py-2.5 text-right font-medium text-gray-700">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {transactions.map(({ tx, direction }) => (
                                  <tr key={`${bucket.id}-${tx.id}-${direction}`} className="hover:bg-gray-50/80 align-top">
                                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                      <div>{formatISTDate(tx.business_date)}</div>
                                      <div className="text-xs text-gray-400">{formatISTDateTime(tx.created_at)}</div>
                                    </td>
                                    <td className="px-3 sm:px-4 py-3 font-medium max-w-[140px]">
                                      {toTitleCase(tx.transaction_type)}
                                    </td>
                                    <td className="px-3 sm:px-4 py-3">
                                      <span
                                        className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                          direction === 'in'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}
                                      >
                                        {direction === 'in' ? 'In' : 'Out'}
                                      </span>
                                    </td>
                                    <td
                                      className={`px-3 sm:px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap ${
                                        direction === 'in' ? 'text-green-700' : 'text-red-700'
                                      }`}
                                    >
                                      {direction === 'in' ? '+' : '−'}{formatInr(tx.amount)}
                                    </td>
                                  </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab */}
            {activeDataTab === 'notes' && (
              <div className="min-w-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2 min-w-0">
                    <StickyNote className="w-5 h-5 text-violet-600 shrink-0" />
                    <span className="truncate">Notes & follow-ups ({pumpNotes.length})</span>
                  </h3>
                  {!noteFormOpen && (
                    <button
                      type="button"
                      onClick={openNoteForm}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 active:bg-violet-800 shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      Add follow-up
                    </button>
                  )}
                </div>

                {noteFormOpen && (
                  <div className="mb-5 sm:mb-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-md overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 border-b border-violet-100 bg-white/80">
                      <p className="text-sm sm:text-base font-semibold text-gray-900">
                        {noteForm.id ? 'Edit follow-up' : 'New follow-up'}
                      </p>
                      <button
                        type="button"
                        onClick={resetNoteForm}
                        disabled={noteSaving}
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-50"
                        aria-label="Close form"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4 sm:p-5">
                      <textarea
                        value={noteForm.body}
                        onChange={(e) => setNoteForm((f) => ({ ...f, body: e.target.value }))}
                        rows={5}
                        placeholder="Follow-up details, call summary, WhatsApp message, etc."
                        className="w-full min-h-[120px] px-3 py-3 sm:px-4 border border-gray-300 rounded-xl bg-white text-sm sm:text-base leading-relaxed focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                        disabled={noteSaving}
                        autoFocus
                      />
                      {noteFormError && (
                        <p className="text-sm text-red-600 mt-3">{noteFormError}</p>
                      )}
                      <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap gap-2 sm:gap-3 mt-4">
                        <button
                          type="button"
                          onClick={resetNoteForm}
                          disabled={noteSaving}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNote}
                          disabled={noteSaving}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 shadow-sm"
                        >
                          <Save className="w-4 h-4" />
                          {noteSaving ? 'Saving...' : noteForm.id ? 'Update follow-up' : 'Save follow-up'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {dataLoading.notes ? (
                  <div className="text-center py-10 sm:py-12 text-gray-500">Loading notes...</div>
                ) : pumpNotes.length === 0 ? (
                  <div className="text-center py-10 sm:py-14 px-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                    <StickyNote className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-600 font-medium text-sm sm:text-base">No follow-ups yet for this pump</p>
                    {!noteFormOpen && (
                      <button
                        type="button"
                        onClick={openNoteForm}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add first follow-up
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {pumpNotes.map((note) => {
                      const isEditing = noteForm.id === note.id && noteFormOpen
                      const followUpTime = formatISTDateTime(note.follow_up_at || note.created_at)
                      return (
                        <article
                          key={note.id}
                          className={`relative rounded-2xl border bg-white shadow-sm transition-all overflow-hidden ${
                            isEditing
                              ? 'border-violet-400 ring-2 ring-violet-200 shadow-md'
                              : 'border-gray-200 hover:border-violet-200 hover:shadow-md'
                          }`}
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1 sm:w-1.5 bg-violet-500 rounded-l-2xl" aria-hidden />
                          <div className="pl-4 pr-3 py-4 sm:pl-5 sm:pr-5 sm:py-5">
                            <p className="text-sm sm:text-[15px] text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
                              {note.body}
                            </p>
                            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                              <div className="min-w-0 flex-1 flex flex-col gap-3">
                                {note.author_name && (
                                  <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-700 font-semibold">
                                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-violet-600" />
                                    <span className="truncate">{note.author_name}</span>
                                  </div>
                                )}
                                <div className="flex items-start sm:items-center gap-1.5 text-xs sm:text-sm text-violet-800 font-medium">
                                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 mt-0.5 sm:mt-0" />
                                  <span className="break-words">{followUpTime}</span>
                                </div>
                                {note.updated_at && note.updated_at !== note.created_at && (
                                  <p className="text-xs text-gray-400 pl-5 sm:pl-0">
                                    Edited {formatISTRelativeTime(note.updated_at)}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-row items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEditNote(note)}
                                  className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 disabled:opacity-50 leading-none"
                                  disabled={noteSaving || noteDeletingId === note.id}
                                >
                                  <Pencil className="w-3 h-3 shrink-0" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium text-red-700 bg-red-50 border border-red-100 hover:bg-red-100 disabled:opacity-50 leading-none"
                                  disabled={noteDeletingId === note.id}
                                >
                                  <Trash2 className="w-3 h-3 shrink-0" />
                                  {noteDeletingId === note.id ? '…' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeDataTab === 'activity' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Activity ({auditLogsTotal.toLocaleString('en-IN')})
                </h3>
                {dataLoading.activity ? (
                  <div className="text-center py-8">Loading activity...</div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No activity recorded for this pump</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-100">
                            {log.action_label || log.action}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{log.entity_label || log.entity_type}</span>
                        </div>
                        {log.reason && (
                          <p className="text-sm text-gray-600 italic mb-2">"{log.reason}"</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {log.actor_name || 'System'}
                          </span>
                          <span className="inline-flex items-center gap-1" title={formatISTDateTime(log.created_at, { withSeconds: true })}>
                            <Clock className="w-3.5 h-3.5" />
                            {formatISTRelativeTime(log.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{formatISTDateTime(log.created_at, { withSeconds: true })}</p>
                      </div>
                    ))}
                    {auditLogs.length < auditLogsTotal && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        Showing latest {auditLogs.length} of {auditLogsTotal.toLocaleString('en-IN')} entries
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error logs Tab */}
            {activeDataTab === 'error-logs' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Error logs ({errorLogs.length})
                </h3>
                {dataLoading['error-logs'] ? (
                  <div className="text-center py-8">Loading error logs...</div>
                ) : errorLogs.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No errors logged for this pump</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700 w-48">When (IST)</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {errorLogs.map((err) => (
                          <tr key={err.id} className="hover:bg-gray-50 align-top">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium text-gray-900">{formatISTRelativeTime(err.created_at)}</div>
                              <div className="text-xs text-gray-500">{formatISTDateTime(err.created_at, { withSeconds: true })}</div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-gray-900 whitespace-pre-wrap break-words">
                                {err.error_message || '—'}
                              </p>
                            </td>
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
                    {formatISTDateTime(pump.created_at)}
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
                      ? formatISTDateTime(pump.last_active_at)
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
                      Verified on: {formatISTDate(pump.payment_verified_at)}
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
                        ? formatISTDate(pump.subscription_start_date)
                        : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="p-5 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl border border-pink-200 hover:shadow-md transition-shadow">
                    <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide mb-2">End Date</p>
                    <p className="font-bold text-lg text-gray-900">
                      {pump.subscription_start_date
                        ? formatISTDate(pump.subscription_end_date)
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
                      type="button"
                      onClick={handleQuickApprove}
                      disabled={saving}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {saving ? 'Approving...' : 'Quick Approve'}
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
                    type="button"
                    onClick={openPasswordModal}
                    disabled={!isSupportAdmin || users.length === 0}
                    title={
                      !isSupportAdmin
                        ? 'Only support@petrofi.com can set or view user passwords'
                        : users.length === 0
                        ? 'No users found for this pump'
                        : 'Set or view password for pump users'
                    }
                    className={`px-4 py-2 rounded-lg inline-flex items-center gap-2 ${
                      isSupportAdmin && users.length > 0
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-indigo-200 text-indigo-400 cursor-not-allowed'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    Set / View Password
                  </button>
                  {!isSupportAdmin ? (
                    <p className="text-xs text-gray-500 mt-2">
                      Password actions are restricted to support@petrofi.com.
                    </p>
                  ) : users.length === 0 ? (
                    <p className="text-xs text-gray-500 mt-2">No users found for this pump.</p>
                  ) : null}
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
                    type="button"
                    onClick={openDeleteModal}
                    disabled={!isSupportAdmin}
                    title={
                      isSupportAdmin
                        ? 'Permanently delete this pump'
                        : 'Only support@petrofi.com can delete petrol pumps'
                    }
                    className={`px-4 py-2 rounded-lg inline-flex items-center gap-2 ${
                      isSupportAdmin
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-red-200 text-red-400 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Pump
                  </button>
                  {!isSupportAdmin && (
                    <p className="text-xs text-red-600 mt-2">
                      Delete is restricted to support@petrofi.com.
                    </p>
                  )}
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
            <p><span className="font-medium">Created:</span> {pump.created_at ? formatISTDateTime(pump.created_at) : 'N/A'}</p>
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
    </div>
  )
}
