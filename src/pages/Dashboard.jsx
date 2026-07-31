import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCount } from '../lib/format'
import KpiCard from '../components/ui/KpiCard'
import StatusPill from '../components/ui/StatusPill'
import EmptyState from '../components/ui/EmptyState'
import { DashboardSkeleton } from '../components/ui/Skeleton'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPumps: 0,
    activePumps: 0,
    pendingPumps: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentPumps, setRecentPumps] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [pumpsRes, recentRes] = await Promise.all([
          supabase.from('pumps').select('id, is_active, registration_status'),
          supabase
            .from('pumps')
            .select('id, name, pump_code, registration_status, is_active, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        if (cancelled) return
        if (pumpsRes.error) throw pumpsRes.error

        const pumps = pumpsRes.data || []
        setStats({
          totalPumps: pumps.length,
          activePumps: pumps.filter((p) => p.is_active).length,
          pendingPumps: pumps.filter((p) => p.registration_status === 'pending').length,
        })
        setRecentPumps(recentRes.data || [])
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const statCards = useMemo(
    () => [
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
    ],
    [stats]
  )

  if (loading) return <DashboardSkeleton />

  return (
    <div className="pf-page space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="pf-meta mt-1">Manage pumps and registrations</p>
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
