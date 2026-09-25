import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase, hasAdminServiceRole, hasSupabaseAuthConfig } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pumps from './pages/Pumps'
import PumpDetail from './pages/PumpDetail'
import Users from './pages/Users'
import Sales from './pages/Sales'
import Expenses from './pages/Expenses'
import MeterReadings from './pages/MeterReadings'
import Leads from './pages/Leads'
import Settings from './pages/Settings'
import AuditLogs from './pages/AuditLogs'
import ErrorLogs from './pages/ErrorLogs'
import AuthUsersAudit from './pages/AuthUsersAudit'
import PumpNotesAudit from './pages/PumpNotesAudit'
import PaymentHistory from './pages/PaymentHistory'
import Plans from './pages/Plans'
import Layout from './components/Layout'

function ConfigMissing({ title, body }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-muted">
      <div className="max-w-lg w-full bg-surface border border-line rounded-card p-6 shadow-soft">
        <h1 className="text-lg font-semibold text-ink mb-2">{title}</h1>
        <p className="text-sm text-ink-secondary whitespace-pre-wrap">{body}</p>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!hasSupabaseAuthConfig) {
    return (
      <ConfigMissing
        title="Supabase env missing"
        body={`Your local .env is empty or incomplete.

Add these to .env (or .env.local), then restart npm run dev:

VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

For admin data after RLS, also set on Vercel (not required in local .env if you only test production):
VITE_SUPABASE_SERVICE_ROLE_KEY=...`}
      />
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (user && !hasAdminServiceRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-muted">
        <div className="max-w-lg w-full bg-surface border border-line rounded-card p-6 shadow-soft">
          <h1 className="text-lg font-semibold text-ink mb-2">Admin data access not configured</h1>
          <p className="text-sm text-ink-secondary mb-3">
            Dealer-scoped RLS is enabled. This admin panel needs the service role key to load and save data.
          </p>
          <p className="text-sm text-ink-secondary font-mono bg-surface-muted rounded-control px-3 py-2">
            Set VITE_SUPABASE_SERVICE_ROLE_KEY in Vercel (or GitHub) environment variables, then redeploy / rebuild.
            For local testing you can put it in gitignored .env.local.
          </p>
          <button
            type="button"
            className="mt-4 pf-btn-secondary"
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
          >
            Sign out
          </button>
        </div>
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
          <Route path="plans" element={<Plans />} />
          <Route path="pumps" element={<Pumps />} />
          <Route path="pumps/:id" element={<PumpDetail />} />
          <Route path="pumps/:id/information" element={<PumpDetail />} />
          <Route path="pumps/:id/setup" element={<PumpDetail />} />
          <Route path="users" element={<Users />} />
          <Route path="sales" element={<Sales />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="meter-readings" element={<MeterReadings />} />
          <Route path="leads" element={<Leads />} />
          <Route path="settings" element={<Settings />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="error-logs" element={<ErrorLogs />} />
          <Route path="auth-users-audit" element={<AuthUsersAudit />} />
          <Route path="notes-audit" element={<PumpNotesAudit />} />
          <Route path="payment-history" element={<PaymentHistory />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
