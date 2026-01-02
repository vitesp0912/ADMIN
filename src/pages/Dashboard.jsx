import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Building2, Users, ShoppingCart, Receipt, TrendingUp, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
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

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch pumps stats
      const { data: pumps, error: pumpsError } = await supabase
        .from('pumps')
        .select('id, is_active, registration_status')

      if (pumpsError) throw pumpsError

      const totalPumps = pumps?.length || 0
      const activePumps = pumps?.filter(p => p.is_active).length || 0
      const pendingPumps = pumps?.filter(p => p.registration_status === 'pending').length || 0

      // Fetch users count
      const { count: totalUsers, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      if (usersError) throw usersError

      // Fetch sales total (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('total_amount')
        .gte('date_time', thirtyDaysAgo.toISOString())

      if (salesError) throw salesError

      const totalSales = sales?.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0) || 0

      // Fetch expenses total (last 30 days)
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date_time', thirtyDaysAgo.toISOString())

      if (expensesError) throw expensesError

      const totalExpenses = expenses?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0

      // Fetch recent pumps
      const { data: recent, error: recentError } = await supabase
        .from('pumps')
        .select('id, name, pump_code, registration_status, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentError) throw recentError

      setStats({
        totalPumps,
        activePumps,
        pendingPumps,
        totalUsers: totalUsers || 0,
        totalSales,
        totalExpenses,
      })
      setRecentPumps(recent || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Pumps',
      value: stats.totalPumps,
      icon: Building2,
      color: 'blue',
      link: '/pumps',
    },
    {
      title: 'Active Pumps',
      value: stats.activePumps,
      icon: Building2,
      color: 'green',
      link: '/pumps',
    },
    {
      title: 'Pending Registrations',
      value: stats.pendingPumps,
      icon: AlertCircle,
      color: 'yellow',
      link: '/pumps',
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'purple',
      link: '/users',
    },
    {
      title: 'Sales (30 days)',
      value: `₹${stats.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: ShoppingCart,
      color: 'green',
      link: '/sales',
    },
    {
      title: 'Expenses (30 days)',
      value: `₹${stats.totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: Receipt,
      color: 'red',
      link: '/expenses',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Overview of your petrol pump management system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          const colorGradients = {
            blue: 'from-blue-500 to-blue-600',
            green: 'from-green-500 to-green-600',
            yellow: 'from-yellow-400 to-yellow-500',
            purple: 'from-purple-500 to-purple-600',
            red: 'from-red-500 to-red-600',
          }
          const iconBgColors = {
            blue: 'bg-blue-100',
            green: 'bg-green-100',
            yellow: 'bg-yellow-100',
            purple: 'bg-purple-100',
            red: 'bg-red-100',
          }
          const iconColors = {
            blue: 'text-blue-600',
            green: 'text-green-600',
            yellow: 'text-yellow-600',
            purple: 'text-purple-600',
            red: 'text-red-600',
          }

          return (
            <Link
              key={index}
              to={stat.link}
              className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`${iconBgColors[stat.color]} p-4 rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-7 h-7 ${iconColors[stat.color]}`} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Recent Pumps */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-600" />
          Recent Pumps
        </h2>
        {recentPumps.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-500 font-medium">No pumps found</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Pump Code</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Registration</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentPumps.map((pump) => (
                  <tr key={pump.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{pump.pump_code || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{pump.name}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          pump.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {pump.is_active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          pump.registration_status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : pump.registration_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {pump.registration_status === 'approved' ? '✓ Approved' : 
                         pump.registration_status === 'pending' ? '⏳ Pending' : 
                         pump.registration_status === 'rejected' ? '✗ Rejected' : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(pump.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/pumps/${pump.id}`}
                        className="text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors"
                      >
                        View →
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

