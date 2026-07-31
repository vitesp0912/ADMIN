import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('petrofi-theme') || 'light'
    } catch {
      return 'light'
    }
  })
  const navigate = useNavigate()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try {
      localStorage.setItem('petrofi-theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) throw loginError

      if (data.user) {
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden">
      {/* Atmosphere — subtle brand-tinted plane, not a flashy gradient stack */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgb(var(--brand-soft)), transparent 55%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(rgb(var(--ink)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--ink)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <button
        type="button"
        className="absolute top-4 right-4 z-10 pf-btn-ghost !px-2"
        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Brand hero */}
          <div className="text-center mb-8">
            <img
              src="/app_icon.png"
              alt="PetroFI"
              className="w-[88px] h-[88px] mx-auto object-contain drop-shadow-sm"
              width={88}
              height={88}
            />
            <h1 className="mt-5 text-[28px] font-semibold tracking-tight text-ink leading-none">
              PetroFI
            </h1>
            <p className="mt-2 text-[14px] text-ink-secondary">
              Petrol pump admin console
            </p>
          </div>

          <div className="pf-card p-7 sm:p-8">
            <div className="mb-6">
              <h2 className="text-[18px] font-semibold text-ink tracking-tight">
                Sign in
              </h2>
              <p className="text-[13px] text-ink-secondary mt-1">
                Use your admin credentials to continue
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-control border border-transparent bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-ink-secondary mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pf-input !h-10"
                  placeholder="admin@example.com"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-ink-secondary mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pf-input !h-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="pf-btn-primary w-full !h-10 mt-2"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-ink-muted mt-6">
            Secure access for PetroFI administrators
          </p>
        </div>
      </div>
    </div>
  )
}
