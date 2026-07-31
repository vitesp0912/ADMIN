import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Receipt } from 'lucide-react'
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

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [pumps, setPumps] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchExpenses()
  }, [dateFilter, startDate, endDate])

  const fetchExpenses = async () => {
    try {
      let query = supabase
        .from('expenses')
        .select('*')
        .order('date_time', { ascending: false })
        .limit(1000)

      if (dateFilter === 'today') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        query = query.gte('date_time', today.toISOString())
      } else if (dateFilter === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        query = query.gte('date_time', weekAgo.toISOString())
      } else if (dateFilter === 'month') {
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        query = query.gte('date_time', monthAgo.toISOString())
      } else if (dateFilter === 'custom' && startDate && endDate) {
        query = query
          .gte('date_time', new Date(startDate).toISOString())
          .lte('date_time', new Date(endDate).toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      setExpenses(data || [])

      // Fetch pump names
      const pumpIds = [...new Set((data || []).map((e) => e.pump_id))]
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
      console.error('Error fetching expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      pumps[expense.pump_id]?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pumps[expense.pump_id]?.pump_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0)

  if (loading) {
    return (
      <div className="pf-page flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-ink-secondary font-medium">Loading expenses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pf-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-ink mb-2 flex items-center gap-2">
          <Receipt className="w-8 h-8 text-red-600" />
          Expenses
        </h1>
        <p className="text-ink-secondary">View all expense entries</p>
      </div>

      {/* Filters and Stats */}
      <div className="bg-surface rounded-xl shadow-lg border border-line p-6 mb-6 hover:shadow-xl transition-shadow duration-300">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-muted w-5 h-5" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-line-strong rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
          {dateFilter === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-5 rounded-xl border border-red-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Total Expenses</p>
            <p className="text-3xl font-bold text-ink">
              ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-xl border border-line hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">Total Entries</p>
            <p className="text-3xl font-bold text-ink">{filteredExpenses.length}</p>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-surface rounded-xl shadow-lg border border-line overflow-hidden hover:shadow-xl transition-shadow duration-300">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center bg-surface-muted rounded-xl border-2 border-dashed border-line-strong">
            <Receipt className="w-16 h-16 text-ink-muted mx-auto mb-4" />
            <p className="text-ink-muted text-lg font-medium">No expenses found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Pump
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Payment Mode
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-line">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-red-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink">
                      {format(new Date(expense.date_time), 'dd MMM yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pumps[expense.pump_id] ? (
                        <div>
                          <div className="text-sm font-medium text-ink">
                            {pumps[expense.pump_id].name}
                          </div>
                          <div className="text-sm text-ink-muted">
                            {pumps[expense.pump_id].pump_code}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-ink-muted">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        {expense.category ? toTitleCase(expense.category) : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-ink">
                      {expense.description ? toTitleCase(expense.description) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-ink">
                      ₹{parseFloat(expense.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-info">
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
    </div>
  )
}

