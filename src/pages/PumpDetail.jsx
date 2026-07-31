import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate, useLocation, NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Building2, Phone, Mail, MapPin, User, Users, Calendar, DollarSign, CheckCircle, XCircle, Settings, Save, ShoppingCart, Gauge, Receipt, Package, BookOpen, Eye, Trash2, AlertTriangle, Fuel, ClipboardList, FileText, AlertCircle, Clock, StickyNote, Pencil, Plus, X, Wallet, ArrowLeftRight, ShoppingBag } from 'lucide-react'
import { formatISTDate, formatISTDateTime, formatISTRelativeTime, phoneToTel } from '../lib/datetime'
import { isSupportAdminEmail, SUPPORT_ADMIN_EMAIL } from '../lib/authAccess'
import PumpSignupSetup from '../components/PumpSignupSetup'
import StatusPill from '../components/ui/StatusPill'
import { Skeleton } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

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

/** Format Postgres `time` values (HH:MM:SS or HH:MM) for display */
const formatShiftTime = (timeValue) => {
  if (!timeValue) return '—'
  const raw = String(timeValue)
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return raw
  let hours = parseInt(match[1], 10)
  const minutes = match[2]
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${hours}:${minutes} ${ampm}`
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

const DATA_TABS = [
  { id: 'activity', label: 'Activity' },
  { id: 'users', label: 'Users' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'inventory-purchases', label: 'Inventory purchases' },
  { id: 'inventory-sales', label: 'Inventory sales' },
  { id: 'customers', label: 'Customers' },
  { id: 'udhar-ledger', label: 'Udhar ledger' },
  { id: 'sales', label: 'Digital Sales' },
  { id: 'meter-readings', label: 'Meter Readings' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'shifts', label: 'Shifts' },
  { id: 'tanks', label: 'Tanks' },
  { id: 'fuel-receipts', label: 'Fuel receipts' },
  { id: 'bank-accounts', label: 'Bank accounts' },
  { id: 'treasury-transactions', label: 'Transactions' },
  { id: 'notes', label: 'Notes' },
  { id: 'error-logs', label: 'Error logs' },
]

export default function PumpDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isInformationView = /\/information\/?$/.test(location.pathname)
  const isSetupView = /\/setup\/?$/.test(location.pathname)
  const isDataView = !isInformationView && !isSetupView
  const [pump, setPump] = useState(null)
  const [users, setUsers] = useState([])
  const [sales, setSales] = useState([])
  const [meterReadings, setMeterReadings] = useState([])
  const [nozzles, setNozzles] = useState({})
  const [fuelTypes, setFuelTypes] = useState({})
  const [expenses, setExpenses] = useState([])
  const [inventory, setInventory] = useState([])
  const [inventoryPurchases, setInventoryPurchases] = useState([])
  const [inventorySales, setInventorySales] = useState([])
  const [customers, setCustomers] = useState([])
  const [udharLedger, setUdharLedger] = useState([])
  const [ledgerCustomers, setLedgerCustomers] = useState({})
  const [ledgerStaff, setLedgerStaff] = useState({})
  const [loading, setLoading] = useState(true)
  const [treasuryBuckets, setTreasuryBuckets] = useState([])
  const [treasuryLedger, setTreasuryLedger] = useState([])
  const [shifts, setShifts] = useState([])

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

  const shiftById = useMemo(() => {
    const map = {}
    shifts.forEach((s) => {
      map[s.id] = s
    })
    return map
  }, [shifts])

  const shiftLabel = (shiftId) => {
    if (!shiftId) return '—'
    const s = shiftById[shiftId]
    if (!s) return '—'
    return s.name || `Shift ${s.sequence}` || '—'
  }

  const inventoryById = useMemo(() => {
    const map = {}
    inventory.forEach((item) => {
      map[item.id] = item
    })
    return map
  }, [inventory])

  const inventoryProductLabel = (productId) => {
    if (!productId) return '—'
    return inventoryById[productId]?.name || '—'
  }

  const bucketLabel = (bucketId) => {
    if (!bucketId) return '—'
    const b = treasuryBucketById[bucketId]
    return b?.name || '—'
  }

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
  const [activeDataTab, setActiveDataTab] = useState('activity')
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
      setIsSupportAdmin(isSupportAdminEmail(user?.email))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isSupportAdmin && (activeTab === 'subscription' || activeTab === 'actions')) {
      setActiveTab('details')
    }
  }, [isSupportAdmin, activeTab])

  useEffect(() => {
    if (pump && !pump.is_active && isSetupView) {
      navigate(`/pumps/${id}/information`, { replace: true })
    }
  }, [pump, isSetupView, id, navigate])

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
          await fetchShiftsForPump(id)
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
          await fetchShiftsForPump(id)
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
          await fetchShiftsForPump(id)
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

        case 'inventory-purchases': {
          const [{ data: purchaseData, error: purchaseErr }, { data: invData, error: invErr }, bucketsRes] =
            await Promise.all([
              supabase
                .from('inventory_purchases')
                .select('*')
                .eq('pump_id', id)
                .order('purchase_date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(500),
              supabase
                .from('inventory')
                .select('id, name')
                .eq('pump_id', id),
              supabase
                .from('treasury_buckets')
                .select('*')
                .eq('pump_id', id)
                .order('display_order', { ascending: true }),
            ])
          if (purchaseErr) {
            console.error('Inventory purchases fetch error:', purchaseErr)
            throw purchaseErr
          }
          if (invErr) console.error('Inventory products lookup:', invErr)
          if (bucketsRes.error) console.error('Buckets lookup:', bucketsRes.error)
          setInventoryPurchases(purchaseData || [])
          if (invData) {
            setInventory((prev) => {
              const map = { ...Object.fromEntries(prev.map((p) => [p.id, p])) }
              invData.forEach((p) => {
                map[p.id] = { ...(map[p.id] || {}), ...p }
              })
              return Object.values(map)
            })
          }
          if (bucketsRes.data) setTreasuryBuckets(bucketsRes.data)
          break
        }

        case 'inventory-sales': {
          const [{ data: salesInvData, error: salesInvErr }, customersRes] = await Promise.all([
            supabase
              .from('inventory_sales')
              .select('*')
              .eq('pump_id', id)
              .order('sold_at', { ascending: false })
              .limit(500),
            supabase
              .from('customers')
              .select('id, name, phone')
              .eq('pump_id', id),
          ])
          if (salesInvErr) {
            console.error('Inventory sales fetch error:', salesInvErr)
            throw salesInvErr
          }
          setInventorySales(salesInvData || [])
          if (!customersRes.error && customersRes.data) {
            const m = {}
            customersRes.data.forEach((c) => {
              m[c.id] = c
            })
            setLedgerCustomers((prev) => ({ ...prev, ...m }))
          }
          await fetchShiftsForPump(id)
          break
        }

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
          await fetchShiftsForPump(id)
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

        case 'shifts': {
          await fetchShiftsForPump(id)
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

  const fetchShiftsForPump = async (pumpId) => {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, name, sequence, start_time, end_time, is_active')
        .eq('pump_id', pumpId)
        .order('sequence', { ascending: true })
      if (error) {
        console.error('Shifts fetch error:', error)
        return
      }
      setShifts(data || [])
    } catch (err) {
      console.error('Error fetching shifts:', err)
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

  const handleQuickReject = async () => {
    const rejectedFormData = {
      ...formData,
      is_active: false,
      registration_status: 'rejected',
      subscription_status: 'pending',
    }

    setFormData(rejectedFormData)
    await handleSaveChanges(rejectedFormData)
  }

  const openPasswordModal = () => {
    if (!isSupportAdmin) {
      setMessage({
        type: 'error',
        text: `Only ${SUPPORT_ADMIN_EMAIL} can set or view user passwords.`,
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
      setPasswordError(`Only ${SUPPORT_ADMIN_EMAIL} can set or view user passwords.`)
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
      if (!isSupportAdminEmail(user?.email)) {
        throw new Error(`Only ${SUPPORT_ADMIN_EMAIL} can set or view user passwords.`)
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
        text: `Only ${SUPPORT_ADMIN_EMAIL} can delete petrol pumps.`,
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
        text: `Only ${SUPPORT_ADMIN_EMAIL} can delete petrol pumps.`,
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
      if (!isSupportAdminEmail(user?.email)) {
        throw new Error(`Only ${SUPPORT_ADMIN_EMAIL} can delete petrol pumps.`)
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

  const selectDataTab = (tabId) => {
    setActiveDataTab(tabId)
    if (tabId && tabId !== 'users') fetchTabData(tabId)
  }

  if (loading) {
    return (
      <div className="pf-page space-y-4" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!pump) {
    return (
      <div className="pf-page text-center py-16">
        <p className="text-ink-secondary text-[15px]">Pump not found</p>
        <Link to="/pumps" className="pf-btn-primary mt-4 inline-flex">
          Back to pumps
        </Link>
      </div>
    )
  }

  const infoModules = [
    { id: 'details', label: 'Overview', icon: Building2 },
    ...(isSupportAdmin ? [{ id: 'subscription', label: 'Subscription', icon: DollarSign }] : []),
    { id: 'management', label: 'Management', icon: Settings },
    ...(isSupportAdmin ? [{ id: 'actions', label: 'Actions', icon: AlertTriangle }] : []),
  ]

  const sectionTabClass = ({ isActive }) =>
    `flex-1 sm:flex-none inline-flex items-center justify-center h-9 sm:h-8 px-3 rounded-[6px] text-[12px] sm:text-[13px] font-semibold leading-none whitespace-nowrap transition-colors duration-100 ${
      isActive
        ? 'bg-surface text-ink shadow-soft'
        : 'text-ink-secondary hover:text-ink'
    }`

  return (
    <>
    <div className="pf-page space-y-3 sm:space-y-4 min-w-0 overflow-x-hidden">
      {/* Page chrome — stacks on mobile, row on desktop */}
      <div className="pf-card px-3 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Link
              to="/pumps"
              className="pf-btn-ghost !px-2 !h-9 shrink-0 mt-0.5"
              aria-label="Back to pumps"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] sm:text-[20px] font-semibold tracking-tight text-ink break-words leading-snug">
                {pump.name}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <StatusPill tone={pump.is_active ? 'ok' : 'neutral'}>
                  {pump.is_active ? 'Active' : 'Inactive'}
                </StatusPill>
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
                <span className="inline-flex items-center gap-1 text-[11px] text-ink-secondary font-mono">
                  <Building2 className="w-3 h-3 shrink-0" />
                  {pump.pump_code || 'N/A'}
                </span>
                {phoneToTel(pump.phone) && (
                  <a
                    href={`tel:${phoneToTel(pump.phone)}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-control border border-line bg-surface text-ink-secondary hover:text-brand-600 hover:border-brand-400 transition-colors"
                    title={`Call pump ${pump.phone}`}
                    aria-label={`Call pump ${pump.phone}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
                {phoneToTel(pump.owner_phone) && pump.owner_phone !== pump.phone && (
                  <a
                    href={`tel:${phoneToTel(pump.owner_phone)}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-control border border-line bg-surface text-ink-secondary hover:text-brand-600 hover:border-brand-400 transition-colors"
                    title={`Call owner ${pump.owner_phone}`}
                    aria-label={`Call owner ${pump.owner_phone}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div
            className="flex w-full sm:w-auto sm:shrink-0 p-0.5 rounded-control border border-line bg-surface-muted"
            role="navigation"
            aria-label="Pump sections"
          >
            <NavLink to={`/pumps/${id}`} end className={sectionTabClass}>
              Pump Data
            </NavLink>
            <NavLink to={`/pumps/${id}/information`} className={sectionTabClass}>
              Pump Information
            </NavLink>
            {pump.is_active && (
              <NavLink to={`/pumps/${id}/setup`} className={sectionTabClass}>
                Pump Setup
              </NavLink>
            )}
          </div>
        </div>
      </div>

      {isDataView && (
      <div className="animate-fade-in">
          <div className="pf-card overflow-hidden">
            <div className="pf-card-header !py-3.5">
              <div>
                <h2 className="pf-section-title">Pump data</h2>
              </div>
            </div>

            {/* Status cards live inside Pump Data */}
            <div className="pf-stat-strip">
              <div className="pf-stat-cell">
                <p className="pf-label">Account status</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <p className="text-[16px] font-semibold text-ink">
                    {pump.is_active ? 'Active' : 'Inactive'}
                  </p>
                  <StatusPill tone={pump.is_active ? 'ok' : 'neutral'}>
                    {pump.is_active ? 'Live' : 'Off'}
                  </StatusPill>
                </div>
                <p className="pf-meta mt-1">Operational flag</p>
              </div>
              <div className="pf-stat-cell">
                <p className="pf-label">Registration</p>
                <p className="text-[16px] font-semibold text-ink mt-1.5 capitalize">
                  {pump.registration_status || '—'}
                </p>
                <p className="pf-meta mt-1">Approval state</p>
              </div>
              <div className="pf-stat-cell">
                <p className="pf-label">Subscription</p>
                <p className="text-[16px] font-semibold text-ink mt-1.5 capitalize">
                  {pump.subscription_status || '—'}
                </p>
                <p className="pf-meta mt-1">
                  {pump.subscription_plan ? toTitleCase(pump.subscription_plan) : 'No plan'}
                </p>
              </div>
              <div className="pf-stat-cell">
                <p className="pf-label">Active users</p>
                <p className="text-[22px] font-semibold text-ink mt-1 tabular-nums leading-none">
                  {users.length}
                </p>
                <p className="pf-meta mt-1.5">Assigned to this pump</p>
              </div>
            </div>
            
            <div className="border-b border-line bg-surface-muted/30 overflow-x-auto">
              <nav className="pf-module-nav" aria-label="Pump data tabs">
                {DATA_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectDataTab(tab.id)}
                    className={`pf-module-tab ${
                      activeDataTab === tab.id ? 'pf-module-tab-active' : ''
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-3 sm:p-4 lg:p-5">

            {/* Users Tab */}
            {activeDataTab === 'users' && (
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-[15px] font-semibold text-ink">Users</h3>
                  <StatusPill tone="neutral">{users.length}</StatusPill>
                </div>
                {users.length === 0 ? (
                  <EmptyState title="No users" description="No users found for this pump." />
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Last login</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td className="font-medium">{user.name || 'N/A'}</td>
                            <td className="text-ink-secondary font-mono text-[12px]">{user.phone || '—'}</td>
                            <td>
                              <StatusPill tone="info">
                                {user.role ? toTitleCase(user.role) : 'N/A'}
                              </StatusPill>
                            </td>
                            <td>
                              <StatusPill tone={user.is_active ? 'ok' : 'neutral'}>
                                {user.is_active ? 'Active' : 'Inactive'}
                              </StatusPill>
                            </td>
                            <td className="text-ink-secondary whitespace-nowrap">
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
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading inventory...</div>
                ) : inventory.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <Package className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No inventory items for this pump</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-600" />
                      Stock ({inventory.length})
                    </h3>
                    <div className="pf-table-wrap">
                      <table className="pf-table compact">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Qty</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Cost</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Selling</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Expiry</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Batch</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Added</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventory.map((row) => (
                            <tr key={row.id} className="hover:bg-surface-muted/60">
                              <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
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
                              <td className="px-4 py-3 text-ink-secondary">{row.batch_number || '—'}</td>
                              <td className="px-4 py-3 text-ink-muted">
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

            {/* Inventory purchases Tab */}
            {activeDataTab === 'inventory-purchases' && (
              <div>
                <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-amber-600" />
                  Inventory purchases ({inventoryPurchases.length})
                </h3>
                {dataLoading['inventory-purchases'] ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading inventory purchases...</div>
                ) : inventoryPurchases.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <Package className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No inventory purchases for this pump</p>
                  </div>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact min-w-[900px]">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Product</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Units</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Total cost</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Avg cost</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Paid from</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryPurchases.map((row) => (
                          <tr key={row.id} className="hover:bg-surface-muted/60 align-top">
                            <td className="px-4 py-3 whitespace-nowrap">{formatISTDate(row.purchase_date)}</td>
                            <td className="px-4 py-3 font-medium text-ink">
                              {inventoryProductLabel(row.product_id)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{row.units}</td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                              {formatInr(row.total_purchase_cost)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatInr(row.avg_cost_price)}</td>
                            <td className="px-4 py-3">{bucketLabel(row.bucket_id)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Inventory sales Tab */}
            {activeDataTab === 'inventory-sales' && (
              <div>
                <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  Inventory sales ({inventorySales.length})
                </h3>
                {dataLoading['inventory-sales'] ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading inventory sales...</div>
                ) : inventorySales.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No inventory sales for this pump</p>
                  </div>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact min-w-[960px]">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Shift</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Product</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Qty</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Sell price</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Cost</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Profit</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Customer</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Sold at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventorySales.map((row) => {
                          const cust = row.customer_id ? ledgerCustomers[row.customer_id] : null
                          return (
                            <tr key={row.id} className="hover:bg-surface-muted/60 align-top">
                              <td className="px-4 py-3 whitespace-nowrap">
                                {row.sale_date ? formatISTDate(row.sale_date) : '—'}
                              </td>
                              <td className="px-4 py-3 font-medium whitespace-nowrap">
                                {shiftLabel(row.shift_id)}
                              </td>
                              <td className="px-4 py-3 font-medium text-ink">
                                {row.product_name || inventoryProductLabel(row.product_id)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">{row.quantity_sold}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {formatInr(row.unit_selling_price)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {formatInr(row.unit_cost_snap)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">
                                {row.profit != null ? formatInr(row.profit) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                {cust ? (
                                  <div>
                                    <div className="font-medium text-ink">{cust.name || '—'}</div>
                                    {cust.phone && (
                                      <div className="text-xs text-ink-muted font-mono">{cust.phone}</div>
                                    )}
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">
                                {row.sold_at ? formatISTDateTime(row.sold_at) : '—'}
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

            {/* Customers Tab */}
            {activeDataTab === 'customers' && (
              <div>
                {dataLoading['customers'] ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading customers...</div>
                ) : customers.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <Users className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No customers for this pump</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-sky-600" />
                      Customers ({customers.length})
                    </h3>
                    <div className="pf-table-wrap">
                      <table className="pf-table compact">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Phone</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Created</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customers.map((row) => (
                            <tr key={row.id} className="hover:bg-surface-muted/60">
                              <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                              <td className="px-4 py-3 font-mono text-ink">{row.phone}</td>
                              <td className="px-4 py-3 text-ink-muted">
                                {row.created_at
                                  ? formatISTDateTime(row.created_at)
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-ink-muted">
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
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading transactions...</div>
                ) : udharLedger.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No udhar / credit transactions for this pump</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-ink flex flex-wrap items-center gap-x-2 gap-y-1">
                      <BookOpen className="w-5 h-5 text-violet-600 shrink-0" />
                      <span>
                        Transactions ({udharLedger.length})
                        <span className="font-normal text-ink-muted text-base font-medium">
                          {' '}
                          · {udharLedgerByCustomer.length} customer
                          {udharLedgerByCustomer.length !== 1 ? 's' : ''}
                        </span>
                      </span>
                    </h3>
                    {udharLedgerByCustomer.map(({ customerId, rows, cust }) => (
                      <div
                        key={customerId}
                        className="rounded-xl border border-line overflow-hidden bg-surface shadow-sm"
                      >
                        <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-line flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Users className="w-4 h-4 text-violet-600 shrink-0" />
                          <span className="font-semibold text-ink">
                            {cust?.name || 'Unknown customer'}
                          </span>
                          {cust?.phone && (
                            <span className="text-sm font-mono text-ink-secondary">{cust.phone}</span>
                          )}
                          <span className="text-xs text-ink-muted ml-auto">
                            {rows.length} transaction{rows.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="pf-table compact">
                            <thead>
                              <tr>
                                <th className="px-4 py-3 text-left font-medium text-ink-secondary">
                                  Business date
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-ink-secondary">Shift</th>
                                <th className="px-4 py-3 text-left font-medium text-ink-secondary">Type</th>
                                <th className="px-4 py-3 text-left font-medium text-ink-secondary">Amount</th>
                                <th className="px-4 py-3 text-left font-medium text-ink-secondary">
                                  Recorded by
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-ink-secondary">Vehicle</th>
                                <th className="px-4 py-3 text-left font-medium text-ink-secondary">Note</th>
                                <th className="px-4 py-3 text-left font-medium text-ink-secondary">Created</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => {
                                const staff = ledgerStaff[row.user_id]
                                const isCredit = row.entry_type === 'credit'
                                return (
                                  <tr key={row.id} className="hover:bg-surface-muted/60">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {row.business_date ? formatISTDate(row.business_date) : '—'}
                                    </td>
                                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                                      {shiftLabel(row.shift_id)}
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
                                    <td className="px-4 py-3 text-ink">{staff?.name || '—'}</td>
                                    <td className="px-4 py-3 font-mono text-ink-secondary">
                                      {row.vehicle_number || '—'}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-ink-secondary max-w-[180px] truncate"
                                      title={row.note || ''}
                                    >
                                      {row.note || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
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
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading sales...</div>
                ) : sales.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No sales found for this pump</p>
                  </div>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Date & Time (IST)</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Shift</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Amount</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-surface-muted/60">
                            <td className="px-4 py-3">{formatISTDateTime(sale.date_time)}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{shiftLabel(sale.shift_id)}</td>
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
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading meter readings...</div>
                ) : meterReadings.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <Gauge className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No meter readings found for this pump</p>
                  </div>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Shift</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Nozzle</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Fuel Type</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Opening</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Closing</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Sales (L)</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Testing (L)</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">RSP Applied</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">RO Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meterReadings.map((reading) => (
                          <tr key={reading.id} className="hover:bg-surface-muted/60">
                            <td className="px-4 py-3">{formatISTDate(reading.date)}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{shiftLabel(reading.shift_id)}</td>
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
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading expenses...</div>
                ) : expenses.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No expenses found for this pump</p>
                  </div>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Shift</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Category</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Description</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Amount</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-surface-muted/60">
                            <td className="px-4 py-3">{formatISTDateTime(expense.date_time)}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{shiftLabel(expense.shift_id)}</td>
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

            {/* Shifts Tab */}
            {activeDataTab === 'shifts' && (
              <div>
                <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-sky-600" />
                  Shifts ({shifts.length})
                </h3>
                {dataLoading.shifts ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading shifts...</div>
                ) : shifts.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No shifts configured for this pump</p>
                  </div>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">#</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Name</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Start</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">End</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shifts.map((shift) => (
                          <tr key={shift.id} className="hover:bg-surface-muted/60">
                            <td className="px-4 py-3 tabular-nums text-ink-secondary">{shift.sequence}</td>
                            <td className="px-4 py-3 font-medium text-ink">{shift.name}</td>
                            <td className="px-4 py-3 tabular-nums">{formatShiftTime(shift.start_time)}</td>
                            <td className="px-4 py-3 tabular-nums">{formatShiftTime(shift.end_time)}</td>
                            <td className="px-4 py-3">
                              {shift.is_active ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-muted text-ink-secondary">No</span>
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

            {/* Tanks Tab */}
            {activeDataTab === 'tanks' && (
              <div>
                <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
                  <Fuel className="w-5 h-5 text-amber-600" />
                  Tanks ({tanks.length})
                </h3>
                <p className="text-sm text-ink-muted mb-4">View only — tanks are not editable from this admin panel.</p>
                {dataLoading.tanks ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading tanks...</div>
                ) : tanks.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <Fuel className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No tanks configured for this pump</p>
                  </div>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Name</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Fuel</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Capacity (L)</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Current (L)</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Initial (L)</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tanks.map((t) => (
                          <tr key={t.id} className="hover:bg-surface-muted/60">
                            <td className="px-4 py-3 font-medium text-ink">{t.name}</td>
                            <td className="px-4 py-3">{fuelTypeLabel(t.fuel_type)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{parseFloat(t.capacity_liters || 0).toFixed(3)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{parseFloat(t.current_volume_liters || 0).toFixed(3)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{parseFloat(t.initial_volume_liters || 0).toFixed(3)}</td>
                            <td className="px-4 py-3">
                              {t.is_active ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-muted text-ink-secondary">No</span>
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
                <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-teal-600" />
                  Fuel receipts ({fuelReceipts.length})
                </h3>
                <p className="text-sm text-ink-muted mb-4">View only — receipts are not editable from this admin panel.</p>
                {dataLoading['fuel-receipts'] ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading fuel receipts...</div>
                ) : fuelReceipts.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No fuel receipts for this pump</p>
                  </div>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Receipt date</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Recorded</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Tank</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Fuel</th>
                          <th className="px-4 py-3 text-right font-medium text-ink-secondary">Qty (L)</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Invoice</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Supplier</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fuelReceipts.map((r) => {
                          const tankRow = tanks.find((x) => x.id === r.tank_id)
                          return (
                            <tr key={r.id} className="hover:bg-surface-muted/60">
                              <td className="px-4 py-3 whitespace-nowrap">
                                {formatISTDate(r.receipt_date)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">
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
                              <td className="px-4 py-3 max-w-[180px] truncate text-ink-secondary" title={r.notes || ''}>
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
                  <h3 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
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
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading bank accounts...</div>
                ) : treasuryBuckets.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <Wallet className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No treasury buckets for this pump</p>
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
                              : 'border-line bg-surface'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-semibold text-ink text-sm">{bucket.name}</h4>
                            {!bucket.is_active && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted text-ink-secondary">Inactive</span>
                            )}
                          </div>
                          <p className="text-xs text-ink-muted mb-3">
                            {BUCKET_TYPE_LABELS[bucket.bucket_type] || toTitleCase(bucket.bucket_type)}
                          </p>
                          <p className="text-lg font-bold text-emerald-800 tabular-nums">{formatInr(bucket.current_balance)}</p>
                          {(bucket.bank_name || bucket.company_name) && (
                            <p className="text-xs text-ink-secondary mt-2 truncate">
                              {[bucket.bank_name, bucket.company_name].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {bucket.account_number_last_four && (
                            <p className="text-xs text-ink-muted mt-1">···· {bucket.account_number_last_four}</p>
                          )}
                        </article>
                      ))}
                    </div>
                    <div className="hidden lg:block pf-table-wrap">
                      <table className="pf-table compact">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Type</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Bank</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Company</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Account</th>
                            <th className="px-4 py-3 text-right font-medium text-ink-secondary">Current balance</th>
                            <th className="px-4 py-3 text-left font-medium text-ink-secondary">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {treasuryBuckets.map((bucket) => (
                            <tr
                              key={bucket.id}
                              className={`hover:bg-surface-muted/60 ${
                                bucket.bucket_type === 'IN_HAND_CASH' ? 'bg-amber-50/30' : ''
                              }`}
                            >
                              <td className="px-4 py-3 font-medium text-ink">{bucket.name}</td>
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
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-muted text-ink-secondary">Inactive</span>
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
                <h3 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2 mb-4">
                  <ArrowLeftRight className="w-5 h-5 text-sky-600 shrink-0" />
                  Transactions ({treasuryLedger.length})
                </h3>
                {dataLoading['treasury-transactions'] ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading transactions...</div>
                ) : treasuryLedger.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No transactions for this pump</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {treasuryLedgerByBucket.map(({ bucket, transactions }) => (
                      <section
                        key={bucket.id}
                        className={`rounded-xl border overflow-hidden ${
                          bucket.bucket_type === 'IN_HAND_CASH'
                            ? 'border-amber-200 bg-amber-50/20'
                            : 'border-line bg-surface'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-line bg-surface-muted/80">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-ink truncate">{bucket.name}</h4>
                            <p className="text-xs text-ink-muted mt-0.5">
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
                          <table className="pf-table compact">
                            <thead className="bg-surface border-b border-line">
                              <tr>
                                <th className="px-3 sm:px-4 py-2.5 text-left font-medium text-ink-secondary">Date</th>
                                <th className="px-3 sm:px-4 py-2.5 text-left font-medium text-ink-secondary">Type</th>
                                <th className="px-3 sm:px-4 py-2.5 text-left font-medium text-ink-secondary">Flow</th>
                                <th className="px-3 sm:px-4 py-2.5 text-right font-medium text-ink-secondary">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {transactions.map(({ tx, direction }) => (
                                  <tr key={`${bucket.id}-${tx.id}-${direction}`} className="hover:bg-surface-muted/60/80 align-top">
                                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                      <div>{formatISTDate(tx.business_date)}</div>
                                      <div className="text-xs text-ink-muted">{formatISTDateTime(tx.created_at)}</div>
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2 min-w-0">
                    <StickyNote className="w-4 h-4 text-brand-500 shrink-0" />
                    <span className="truncate">Notes & follow-ups ({pumpNotes.length})</span>
                  </h3>
                  {!noteFormOpen && (
                    <button type="button" onClick={openNoteForm} className="pf-btn-primary w-full sm:w-auto">
                      <Plus className="w-4 h-4 shrink-0" />
                      Add follow-up
                    </button>
                  )}
                </div>

                {noteFormOpen && (
                  <div className="mb-5 rounded-card border border-line bg-surface overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-surface-muted/50">
                      <p className="text-[13px] font-semibold text-ink">
                        {noteForm.id ? 'Edit follow-up' : 'New follow-up'}
                      </p>
                      <button
                        type="button"
                        onClick={resetNoteForm}
                        disabled={noteSaving}
                        className="pf-btn-ghost !px-2 disabled:opacity-50"
                        aria-label="Close form"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4">
                      <textarea
                        value={noteForm.body}
                        onChange={(e) => setNoteForm((f) => ({ ...f, body: e.target.value }))}
                        rows={5}
                        placeholder="Follow-up details, call summary, WhatsApp message, etc."
                        className="pf-input !h-auto min-h-[120px] py-3 leading-relaxed resize-y"
                        disabled={noteSaving}
                        autoFocus
                      />
                      {noteFormError && (
                        <p className="text-[13px] text-danger mt-3">{noteFormError}</p>
                      )}
                      <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
                        <button
                          type="button"
                          onClick={resetNoteForm}
                          disabled={noteSaving}
                          className="pf-btn-secondary w-full sm:w-auto"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNote}
                          disabled={noteSaving}
                          className="pf-btn-primary w-full sm:w-auto"
                        >
                          <Save className="w-4 h-4" />
                          {noteSaving ? 'Saving...' : noteForm.id ? 'Update follow-up' : 'Save follow-up'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {dataLoading.notes ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading notes...</div>
                ) : pumpNotes.length === 0 ? (
                  <EmptyState
                    title="No follow-ups yet"
                    description="Add a note or follow-up for this pump."
                    action={
                      !noteFormOpen ? (
                        <button type="button" onClick={openNoteForm} className="pf-btn-primary">
                          <Plus className="w-4 h-4" />
                          Add first follow-up
                        </button>
                      ) : null
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {pumpNotes.map((note) => {
                      const isEditing = noteForm.id === note.id && noteFormOpen
                      const followUpTime = formatISTDateTime(note.follow_up_at || note.created_at)
                      return (
                        <article
                          key={note.id}
                          className={`relative rounded-card border bg-surface overflow-hidden ${
                            isEditing
                              ? 'border-brand-400 ring-2 ring-brand-400/20'
                              : 'border-line'
                          }`}
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500" aria-hidden />
                          <div className="pl-4 pr-3 py-4 sm:pl-5">
                            <p className="text-[13px] sm:text-[14px] text-ink whitespace-pre-wrap break-words leading-relaxed">
                              {note.body}
                            </p>
                            <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                              <div className="min-w-0 flex-1 space-y-1.5">
                                {note.author_name && (
                                  <div className="flex items-center gap-1.5 text-[12px] text-ink-secondary font-medium">
                                    <User className="w-3.5 h-3.5 shrink-0 text-brand-500" />
                                    <span className="truncate">{note.author_name}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
                                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                                  <span>{followUpTime}</span>
                                </div>
                                {note.updated_at && note.updated_at !== note.created_at && (
                                  <p className="text-[11px] text-ink-muted">
                                    Edited {formatISTRelativeTime(note.updated_at)}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEditNote(note)}
                                  className="pf-btn-secondary !h-7 !text-[11px]"
                                  disabled={noteSaving || noteDeletingId === note.id}
                                >
                                  <Pencil className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="pf-btn-ghost !h-7 !text-[11px] text-danger hover:bg-danger-soft"
                                  disabled={noteDeletingId === note.id}
                                >
                                  <Trash2 className="w-3 h-3" />
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
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-500" />
                    Activity
                  </h3>
                  <StatusPill tone="neutral">{auditLogsTotal.toLocaleString('en-IN')}</StatusPill>
                </div>
                {dataLoading.activity ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading activity...</div>
                ) : auditLogs.length === 0 ? (
                  <EmptyState
                    title="No activity recorded"
                    description="Audit events for this pump will appear here."
                  />
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Entity</th>
                          <th>Actor</th>
                          <th>When</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td>
                              <StatusPill tone="info">
                                {log.action_label || log.action || '—'}
                              </StatusPill>
                            </td>
                            <td className="font-medium text-ink">
                              {log.entity_label || log.entity_type || '—'}
                            </td>
                            <td className="text-ink-secondary">
                              {log.actor_name || 'System'}
                            </td>
                            <td className="text-ink-secondary whitespace-nowrap">
                              <div className="text-ink">{formatISTRelativeTime(log.created_at)}</div>
                              <div className="text-[11px] text-ink-muted">
                                {formatISTDateTime(log.created_at, { withSeconds: true })}
                              </div>
                            </td>
                            <td className="text-ink-secondary max-w-[240px]">
                              <span className="line-clamp-2" title={log.reason || ''}>
                                {log.reason || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {auditLogs.length < auditLogsTotal && (
                      <p className="text-[12px] text-ink-muted text-center py-3 border-t border-line">
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
                <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Error logs ({errorLogs.length})
                </h3>
                {dataLoading['error-logs'] ? (
                  <div className="text-center py-10 text-[13px] text-ink-muted">Loading error logs...</div>
                ) : errorLogs.length === 0 ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 text-center py-10 px-4">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-ink-muted opacity-60" />
                    <p className="text-[13px] text-ink-secondary font-medium">No errors logged for this pump</p>
                  </div>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table compact">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary w-48">When (IST)</th>
                          <th className="px-4 py-3 text-left font-medium text-ink-secondary">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorLogs.map((err) => (
                          <tr key={err.id} className="hover:bg-surface-muted/60 align-top">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium text-ink">{formatISTRelativeTime(err.created_at)}</div>
                              <div className="text-xs text-ink-muted">{formatISTDateTime(err.created_at, { withSeconds: true })}</div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-ink whitespace-pre-wrap break-words">
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
      )}

      {isInformationView && (
        <div className="animate-fade-in">
          <div className="pf-card overflow-hidden">
            <div className="pf-card-header !py-3.5">
              <div>
                <h2 className="pf-section-title">Pump information</h2>
                <p className="pf-meta mt-0.5">Profile, subscription, and administrative controls</p>
              </div>
            </div>

            <div className="border-b border-line bg-surface-muted/30 overflow-x-auto">
              <nav className="pf-module-nav" aria-label="Pump information modules">
                {infoModules.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`pf-module-tab ${
                        activeTab === tab.id ? 'pf-module-tab-active' : ''
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 opacity-70" />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>

            <div className="p-4 sm:p-5 lg:p-6">

              {message.text && (
                <div
                  className={`mb-4 p-3 rounded-control border text-[13px] font-medium flex items-center gap-2 ${
                    message.type === 'success'
                      ? 'bg-ok-soft text-ok border-transparent'
                      : 'bg-danger-soft text-danger border-transparent'
                  }`}
                >
                  {message.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Details / Overview modules */}
              {activeTab === 'details' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-control border border-line bg-surface-muted/40 p-4">
                      <p className="pf-label">Account</p>
                      <div className="mt-2">
                        <StatusPill tone={pump.is_active ? 'ok' : 'neutral'}>
                          {pump.is_active ? 'Active' : 'Inactive'}
                        </StatusPill>
                      </div>
                    </div>
                    <div className="rounded-control border border-line bg-surface-muted/40 p-4">
                      <p className="pf-label">Registration</p>
                      <div className="mt-2">
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
                      </div>
                    </div>
                    <div className="rounded-control border border-line bg-surface-muted/40 p-4">
                      <p className="pf-label">Payment</p>
                      <div className="mt-2">
                        <StatusPill tone={pump.payment_verified ? 'ok' : 'danger'}>
                          {pump.payment_verified ? 'Verified' : 'Unverified'}
                        </StatusPill>
                      </div>
                    </div>
                    <div className="rounded-control border border-line bg-surface-muted/40 p-4">
                      <p className="pf-label">Subscription</p>
                      <p className="text-[13px] font-semibold text-ink mt-2 capitalize">
                        {pump.subscription_status || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <section className="rounded-card border border-line bg-surface overflow-hidden">
                      <div className="px-4 py-3 border-b border-line flex items-center gap-2 bg-surface-muted/40">
                        <Building2 className="w-4 h-4 text-ink-muted" />
                        <h3 className="text-[13px] font-semibold text-ink">Basic information</h3>
                      </div>
                      <dl className="divide-y divide-line">
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">Pump name</dt>
                          <dd className="text-[13px] font-medium text-ink mt-0.5">{pump.name}</dd>
                        </div>
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">Pump code</dt>
                          <dd className="text-[13px] font-mono font-medium text-ink mt-0.5">{pump.pump_code || 'N/A'}</dd>
                        </div>
                        {pump.gstin && (
                          <div className="px-4 py-3">
                            <dt className="text-[11px] text-ink-muted">GSTIN</dt>
                            <dd className="text-[13px] font-mono font-medium text-ink mt-0.5">{pump.gstin}</dd>
                          </div>
                        )}
                      </dl>
                    </section>

                    <section className="rounded-card border border-line bg-surface overflow-hidden">
                      <div className="px-4 py-3 border-b border-line flex items-center gap-2 bg-surface-muted/40">
                        <MapPin className="w-4 h-4 text-ink-muted" />
                        <h3 className="text-[13px] font-semibold text-ink">Address & location</h3>
                      </div>
                      <dl className="divide-y divide-line">
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">Address</dt>
                          <dd className="text-[13px] font-medium text-ink mt-0.5">{pump.address || 'N/A'}</dd>
                        </div>
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">City / State</dt>
                          <dd className="text-[13px] font-medium text-ink mt-0.5">
                            {[pump.city, pump.state].filter(Boolean).join(', ') || '—'}
                          </dd>
                        </div>
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">PIN</dt>
                          <dd className="text-[13px] font-medium text-ink mt-0.5">{pump.pincode || '—'}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className="rounded-card border border-line bg-surface overflow-hidden">
                      <div className="px-4 py-3 border-b border-line flex items-center gap-2 bg-surface-muted/40">
                        <Phone className="w-4 h-4 text-ink-muted" />
                        <h3 className="text-[13px] font-semibold text-ink">Contact information</h3>
                      </div>
                      <dl className="divide-y divide-line">
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">Pump phone</dt>
                          <dd className="text-[13px] font-mono font-medium text-ink mt-0.5">{pump.phone || '—'}</dd>
                        </div>
                        {pump.email && (
                          <div className="px-4 py-3">
                            <dt className="text-[11px] text-ink-muted">Email</dt>
                            <dd className="text-[13px] font-medium text-ink mt-0.5 break-all">{pump.email}</dd>
                          </div>
                        )}
                      </dl>
                    </section>

                    <section className="rounded-card border border-line bg-surface overflow-hidden">
                      <div className="px-4 py-3 border-b border-line flex items-center gap-2 bg-surface-muted/40">
                        <User className="w-4 h-4 text-ink-muted" />
                        <h3 className="text-[13px] font-semibold text-ink">Owner details</h3>
                      </div>
                      <dl className="divide-y divide-line">
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">Owner name</dt>
                          <dd className="text-[13px] font-medium text-ink mt-0.5">{pump.owner_name || 'N/A'}</dd>
                        </div>
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">Owner phone</dt>
                          <dd className="text-[13px] font-mono font-medium text-ink mt-0.5">{pump.owner_phone || '—'}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className="rounded-card border border-line bg-surface overflow-hidden lg:col-span-2">
                      <div className="px-4 py-3 border-b border-line flex items-center gap-2 bg-surface-muted/40">
                        <Calendar className="w-4 h-4 text-ink-muted" />
                        <h3 className="text-[13px] font-semibold text-ink">Registration & activity</h3>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line">
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">Created at</dt>
                          <dd className="text-[13px] font-medium text-ink mt-0.5">
                            {formatISTDateTime(pump.created_at)}
                          </dd>
                        </div>
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">Last active</dt>
                          <dd className="text-[13px] font-medium text-ink mt-0.5">
                            {pump.last_active_at
                              ? formatISTDateTime(pump.last_active_at)
                              : 'Never'}
                          </dd>
                        </div>
                        <div className="px-4 py-3">
                          <dt className="text-[11px] text-ink-muted">Payment verified on</dt>
                          <dd className="text-[13px] font-medium text-ink mt-0.5">
                            {pump.payment_verified_at
                              ? formatISTDate(pump.payment_verified_at)
                              : '—'}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                </div>
              )}

              {/* Subscription Tab */}
              {isSupportAdmin && activeTab === 'subscription' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">Subscription details</h3>
                    <p className="pf-meta mt-0.5">Plan, billing, and renewal information</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="rounded-card border border-line p-4 bg-surface">
                      <p className="pf-label">Plan</p>
                      <p className="text-[18px] font-semibold text-ink mt-2">
                        {pump.subscription_plan ? toTitleCase(pump.subscription_plan) : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-card border border-line p-4 bg-surface">
                      <p className="pf-label">Status</p>
                      <div className="mt-2">
                        <StatusPill
                          tone={
                            pump.subscription_status === 'active'
                              ? 'ok'
                              : pump.subscription_status === 'pending'
                                ? 'warn'
                                : 'neutral'
                          }
                        >
                          {pump.subscription_status ? toTitleCase(pump.subscription_status) : 'N/A'}
                        </StatusPill>
                      </div>
                    </div>
                    <div className="rounded-card border border-line p-4 bg-surface">
                      <p className="pf-label">Billing cycle</p>
                      <p className="text-[18px] font-semibold text-ink mt-2">
                        {pump.billing_cycle ? toTitleCase(pump.billing_cycle) : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-card border border-line p-4 bg-surface">
                      <p className="pf-label">Start date</p>
                      <p className="text-[15px] font-semibold text-ink mt-2">
                        {pump.subscription_start_date
                          ? formatISTDate(pump.subscription_start_date)
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-card border border-line p-4 bg-surface">
                      <p className="pf-label">End date</p>
                      <p className="text-[15px] font-semibold text-ink mt-2">
                        {pump.subscription_end_date
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
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleQuickApprove}
                      disabled={saving}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {saving ? 'Approving...' : 'Quick Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickReject}
                      disabled={saving}
                      className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-5 h-5" />
                      {saving ? 'Rejecting...' : 'Quick Reject'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  {/* Active Status */}
                  <div className="p-5 border-2 border-line rounded-xl bg-surface hover:border-blue-300 hover:shadow-md transition-all">
                    <label className="flex items-center justify-between mb-3">
                      <span className="font-bold text-ink">Active Status</span>
                      <button
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 shadow-inner ${
                          formData.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow-md transition-transform duration-200 ${
                            formData.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                    <p className="text-sm text-ink-secondary font-medium">
                      {formData.is_active ? '✓ Pump is active and can login' : '✗ Pump is inactive'}
                    </p>
                  </div>

                  {/* Registration Status */}
                  <div className="p-5 border-2 border-line rounded-xl bg-surface hover:border-blue-300 hover:shadow-md transition-all">
                    <label className="block font-bold text-ink mb-3">Registration Status</label>
                    <select
                      value={formData.registration_status}
                      onChange={(e) => setFormData({ ...formData, registration_status: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  {/* Payment Verified */}
                  <div className="p-5 border-2 border-line rounded-xl bg-surface hover:border-blue-300 hover:shadow-md transition-all">
                    <label className="flex items-center justify-between mb-3">
                      <span className="font-bold text-ink">Payment Verified</span>
                      <button
                        onClick={() => setFormData({ ...formData, payment_verified: !formData.payment_verified })}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 shadow-inner ${
                          formData.payment_verified ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow-md transition-transform duration-200 ${
                            formData.payment_verified ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                    <p className="text-sm text-ink-secondary font-medium">
                      {formData.payment_verified ? '✓ Payment has been verified' : '✗ Payment not verified'}
                    </p>
                  </div>

                  {/* Subscription Status */}
                  <div className="p-4 border border-line rounded-lg">
                    <label className="block font-medium text-ink-secondary mb-2">Subscription Status</label>
                    <select
                      value={formData.subscription_status}
                      onChange={(e) => setFormData({ ...formData, subscription_status: e.target.value })}
                      className="w-full px-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Subscription Plan */}
                  <div className="p-4 border border-line rounded-lg">
                    <label className="block font-medium text-ink-secondary mb-2">Subscription Plan</label>
                    <select
                      value={formData.subscription_plan}
                      onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })}
                      className="w-full px-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  {/* Billing Cycle */}
                  <div className="p-4 border border-line rounded-lg">
                    <label className="block font-medium text-ink-secondary mb-2">Billing Cycle</label>
                    <select
                      value={formData.billing_cycle}
                      onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                      className="w-full px-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  {/* Subscription Start Date */}
                  <div className="p-4 border border-line rounded-lg">
                    <label className="block font-medium text-ink-secondary mb-2">Subscription Start Date</label>
                    <input
                      type="date"
                      value={formData.subscription_start_date}
                      onChange={(e) => setFormData({ ...formData, subscription_start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Subscription End Date */}
                  <div className="p-4 border border-line rounded-lg">
                    <label className="block font-medium text-ink-secondary mb-2">Subscription End Date</label>
                    <input
                      type="date"
                      value={formData.subscription_end_date}
                      onChange={(e) => setFormData({ ...formData, subscription_end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              {isSupportAdmin && activeTab === 'actions' && (
              <div className="space-y-4">
                <div className="p-4 border border-line rounded-lg bg-surface">
                  <h3 className="font-semibold text-ink mb-2">User Password Actions</h3>
                  <p className="text-sm text-ink-secondary mb-4">
                    Set/reset password for users linked to this pump.
                  </p>
                  <button
                    type="button"
                    onClick={openPasswordModal}
                    disabled={!isSupportAdmin || users.length === 0}
                    title={
                      !isSupportAdmin
                        ? `Only ${SUPPORT_ADMIN_EMAIL} can set or view user passwords`
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
                    <p className="text-xs text-ink-muted mt-2">
                      Password actions are restricted to {SUPPORT_ADMIN_EMAIL}.
                    </p>
                  ) : users.length === 0 ? (
                    <p className="text-xs text-ink-muted mt-2">No users found for this pump.</p>
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
                        : `Only ${SUPPORT_ADMIN_EMAIL} can delete petrol pumps`
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
                      Delete is restricted to {SUPPORT_ADMIN_EMAIL}.
                    </p>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {isSetupView && pump.is_active && (
        <div className="animate-fade-in">
          <PumpSignupSetup
            pumpName={pump.name}
            onLocalSave={(draft) => {
              console.log('Pump signup draft (local only):', draft)
            }}
          />
        </div>
      )}
    </div>

    {passwordModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-surface rounded-xl shadow-xl w-full max-w-md p-5 relative">
          <button
            className="absolute top-3 right-3 text-ink-muted hover:text-ink-secondary text-xl"
            onClick={closePasswordModal}
            aria-label="Close"
          >
            ×
          </button>
          <h3 className="text-lg font-semibold text-ink mb-3">Set User Password</h3>

          <label className="text-sm font-medium text-ink-secondary mb-1 block">User</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 border border-line-strong rounded-lg mb-3"
            disabled={passwordLoading}
          >
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name || 'Unnamed')} ({u.phone || 'No phone'})
              </option>
            ))}
          </select>

          <label className="text-sm font-medium text-ink-secondary mb-1 block">New Password</label>
          <div className="relative mb-3">
            <input
              type={showPassword ? 'text' : 'password'}
              value={modalPassword}
              onChange={(e) => setModalPassword(e.target.value)}
              className="w-full px-3 py-2 border border-line-strong rounded-lg pr-10"
              placeholder="At least 8 characters"
              disabled={passwordLoading}
            />
            <button
              type="button"
              className="absolute right-2 top-2 text-ink-muted hover:text-ink-secondary"
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
              className="px-3 py-2 rounded-lg border border-line-strong text-ink-secondary"
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
        <div className="bg-surface rounded-xl shadow-xl w-full max-w-xl p-5 relative">
          <button
            className="absolute top-3 right-3 text-ink-muted hover:text-ink-secondary text-xl"
            onClick={closeDeleteModal}
            aria-label="Close"
          >
            ×
          </button>
          <h3 className="text-lg font-semibold text-red-700 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Confirm Pump Deletion
          </h3>
          <p className="text-sm text-ink-secondary mb-3">
            You are about to permanently delete this pump and associated records (based on DB cascade rules).
          </p>

          <div className="bg-surface-muted border border-line rounded-lg p-3 text-sm space-y-1 mb-4">
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
              className="px-3 py-2 rounded-lg border border-line-strong text-ink-secondary"
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
    </>
  )
}
