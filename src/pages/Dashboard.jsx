import { useState, useEffect, useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isSupportAdminEmail } from '../lib/authAccess'
import { formatInr, formatCount, daysAgo } from '../lib/format'
import KpiCard from '../components/ui/KpiCard'
import StatusPill from '../components/ui/StatusPill'
import EmptyState from '../components/ui/EmptyState'
import { DashboardSkeleton } from '../components/ui/Skeleton'
import { Bell, ChevronDown, ChevronUp } from 'lucide-react'

export default function Dashboard() {
  const outletContext = useOutletContext() || {}
  const [localSupportAdmin, setLocalSupportAdmin] = useState(false)
  const isSupportAdmin = outletContext.isSupportAdmin ?? localSupportAdmin

  const [stats, setStats] = useState({
    totalPumps: 0,
    activePumps: 0,
    pendingPumps: 0,
    totalUsers: 0,
    totalSales: 0,
    totalExpenses: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentPumps, setRecentPumps] = useState([])
  const [resetRequests, setResetRequests] = useState([])
  const [showResetList, setShowResetList] = useState(false)
  const [clearLoading, setClearLoading] = useState({})

  useEffect(() => {
    if (outletContext.accessReady) return
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!cancelled) setLocalSupportAdmin(isSupportAdminEmail(user?.email))
    })()
    return () => { cancelled = true }
  }, [outletContext.accessReady])

  const handleClearRequest = async (userId) => {
    setClearLoading((prev) => ({ ...prev, [userId]: true }))
    try {
      const { error } = await supabase
        .from('users')
        .update({ forgot_password_requested: false, forgot_password_requested_at: null })
        .eq('id', userId)
      if (!error) setResetRequests((prev) => prev.filter((u) => u.id !== userId))
    } finally {
      setClearLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const fetchResetRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, role, forgot_password_requested_at')
        .eq('forgot_password_requested', true)
        .order('forgot_password_requested_at', { ascending: true })
      if (error) throw error
      setResetRequests(data || [])
    } catch {
      setResetRequests([])
    }
  }

  const fetchDashboardData = async () => {
    try {
      const thirtyDaysAgo = daysAgo(29)

      const [pumpsRes, usersRes, salesRes, expensesRes, recentRes] = await Promise.all([
        supabase.from('pumps').select('id, is_active, registration_status'),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase
          .from('sales')
          .select('total_amount')
          .gte('date_time', thirtyDaysAgo.toISOString()),
        supabase
          .from('expenses')
          .select('amount')
          .gte('date_time', thirtyDaysAgo.toISOString()),
        supabase
          .from('pumps')
          .select('id, name, pump_code, registration_status, is_active, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (pumpsRes.error) throw pumpsRes.error
      const pumps = pumpsRes.data || []

      const totalSales = (salesRes.data || []).reduce(
        (sum, s) => sum + (parseFloat(s.total_amount) || 0),
        0
      )
      const totalExpenses = (expensesRes.data || []).reduce(
        (sum, e) => sum + (parseFloat(e.amount) || 0),
        0
      )

      setStats({
        totalPumps: pumps.length,
        activePumps: pumps.filter((p) => p.is_active).length,
        pendingPumps: pumps.filter((p) => p.registration_status === 'pending').length,
        totalUsers: usersRes.count || 0,
        totalSales,
        totalExpenses,
      })
      setRecentPumps(recentRes.data || [])
      await fetchResetRequests()
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    const onFocus = () => fetchResetRequests()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const statCards = useMemo(() => {
    const cards = [
      {
        title: 'Total pumps',
        value: formatCount(stats.totalPumps),
        meta: 'All registered pumps',
        href: '/pumps',
        status: 'neutral',
      },
      {
        title: 'Active pumps',
        value: formatCount(stats.activePumps),
        meta: 'Currently active',
        href: '/pumps',
        status: 'ok',
        statusLabel: 'Live',
      },
      {
        title: 'Pending registrations',
        value: formatCount(stats.pendingPumps),
        meta: 'Awaiting approval',
        href: '/pumps',
        status: stats.pendingPumps > 0 ? 'warn' : 'ok',
        statusLabel: stats.pendingPumps > 0 ? 'Action' : 'Clear',
      },
    ]

    if (isSupportAdmin) {
      cards.push(
        {
          title: 'Total users',
          value: formatCount(stats.totalUsers),
          meta: 'Across all pumps',
          href: '/users',
          status: 'info',
        },
        {
          title: 'Sales (30 days)',
          value: formatInr(stats.totalSales),
          meta: 'Portfolio total',
          href: '/sales',
          status: 'neutral',
        },
        {
          title: 'Expenses (30 days)',
          value: formatInr(stats.totalExpenses),
          meta: 'Portfolio total',
          href: '/expenses',
          status: 'neutral',
        }
      )
    }

    return cards
  }, [stats, isSupportAdmin])

  if (loading) return <DashboardSkeleton />

  return (
    <div className="pf-page space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="pf-meta mt-1">Manage pumps, registrations, and support queues</p>
      </div>

      <div className="pf-card overflow-hidden">
        <button
          type="button"
          className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-surface-muted/60 transition-colors"
          onClick={() => setShowResetList((v) => !v)}
        >
          <Bell className="w-4 h-4 text-warn shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">
              {resetRequests.length > 0
                ? `${resetRequests.length} password reset request${resetRequests.length > 1 ? 's' : ''}`
                : 'No password reset requests'}
            </p>
            <p className="text-[12px] text-ink-secondary">
              Clear requests after assisting the user
            </p>
          </div>
          <StatusPill tone={resetRequests.length ? 'warn' : 'ok'}>
            {resetRequests.length}
          </StatusPill>
          {showResetList ? (
            <ChevronUp className="w-4 h-4 text-ink-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-ink-muted" />
          )}
        </button>

        {showResetList && (
          <div className="border-t border-line p-4 space-y-2 bg-surface-muted/30">
            {resetRequests.length === 0 ? (
              <p className="text-[13px] text-ink-muted px-1 py-2">No pending requests.</p>
            ) : (
              resetRequests.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-control border border-line bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink truncate">{u.name || '—'}</p>
                    <p className="text-[11px] text-ink-muted truncate">
                      {u.phone || '—'} · {u.role || '—'}
                      {u.forgot_password_requested_at
                        ? ` · ${new Date(u.forgot_password_requested_at).toLocaleString('en-IN')}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pf-btn-secondary !h-8 shrink-0"
                    disabled={clearLoading[u.id]}
                    onClick={() => handleClearRequest(u.id)}
                  >
                    {clearLoading[u.id] ? 'Clearing…' : 'Clear request'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {statCards.map((card) => (
          <KpiCard
            key={card.title}
            title={card.title}
            value={card.value}
            meta={card.meta}
            href={card.href}
            status={card.status}
            statusLabel={card.statusLabel}
          />
        ))}
      </div>

      <div className="pf-card overflow-hidden">
        <div className="pf-card-header">
          <div>
            <h2 className="pf-section-title">Recent pumps</h2>
            <p className="pf-meta mt-0.5">Latest registrations</p>
          </div>
          <Link to="/pumps" className="text-[12px] font-medium text-brand-600 dark:text-brand-300">
            View all
          </Link>
        </div>

        {recentPumps.length === 0 ? (
          <EmptyState
            title="No pumps found"
            description="New pump registrations will appear here."
            action={<Link to="/pumps" className="pf-btn-primary">Go to pumps</Link>}
          />
        ) : (
          <div className="pf-table-wrap !border-0 !rounded-none">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Pump code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Registration</th>
                  <th>Created</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentPumps.map((pump) => (
                  <tr key={pump.id}>
                    <td className="font-mono text-[12px]">{pump.pump_code || '—'}</td>
                    <td className="font-medium">{pump.name}</td>
                    <td>
                      <StatusPill tone={pump.is_active ? 'ok' : 'neutral'}>
                        {pump.is_active ? 'Active' : 'Inactive'}
                      </StatusPill>
                    </td>
                    <td>
                      <StatusPill
                        tone={
                          pump.registration_status === 'approved'
                            ? 'info'
                            : pump.registration_status === 'pending'
                              ? 'warn'
                              : 'danger'
                        }
                      >
                        {pump.registration_status || '—'}
                      </StatusPill>
                    </td>
                    <td className="text-ink-secondary whitespace-nowrap">
                      {pump.created_at
                        ? new Date(pump.created_at).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/pumps/${pump.id}`}
                        className="text-[12px] font-semibold text-brand-600 dark:text-brand-300"
                      >
                        Open
                      </Link>
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
