import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pumps from './pages/Pumps'
import PumpDetail from './pages/PumpDetail'
import Users from './pages/Users'
import Sales from './pages/Sales'
import Expenses from './pages/Expenses'
import MeterReadings from './pages/MeterReadings'
import SalaryEntries from './pages/SalaryEntries'
import DipEntries from './pages/DipEntries'
import Settings from './pages/Settings'
import AuditLogs from './pages/AuditLogs'
import Layout from './components/Layout'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route
          path="/"
          element={user ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<Dashboard />} />
          <Route path="pumps" element={<Pumps />} />
          <Route path="pumps/:id" element={<PumpDetail />} />
          <Route path="users" element={<Users />} />
          <Route path="sales" element={<Sales />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="meter-readings" element={<MeterReadings />} />
          <Route path="salary-entries" element={<SalaryEntries />} />
          <Route path="dip-entries" element={<DipEntries />} />
          <Route path="settings" element={<Settings />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App

