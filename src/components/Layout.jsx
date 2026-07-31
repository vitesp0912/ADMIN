import { useState, useEffect, useMemo } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isSupportAdminEmail, SUPPORT_ONLY_PATHS } from '../lib/authAccess'
import PasswordResetBell from './PasswordResetBell'
import {
  LayoutDashboard,
  Building2,
  Users,
  ShoppingCart,
  UserRoundPlus,
  Receipt,
  Gauge,
  Settings,
  FileText,
  AlertTriangle,
  LogOut,
  Menu,
  X,
  Search,
  Moon,
  Sun,
} from 'lucide-react'

const ALL_NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/pumps', icon: Building2, label: 'Pumps' },
  { path: '/users', icon: Users, label: 'Users', supportOnly: true },
  { path: '/sales', icon: ShoppingCart, label: 'Sales', supportOnly: true },
  { path: '/leads', icon: UserRoundPlus, label: 'Leads' },
  { path: '/expenses', icon: Receipt, label: 'Expenses', supportOnly: true },
  { path: '/meter-readings', icon: Gauge, label: 'Meter Readings', supportOnly: true },
  { path: '/settings', icon: Settings, label: 'Settings', supportOnly: true },
  { path: '/audit-logs', icon: FileText, label: 'Activity Log', supportOnly: true },
  { path: '/error-logs', icon: AlertTriangle, label: 'Error Logs', supportOnly: true },
]

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/pumps': 'Pumps',
  '/users': 'Users',
  '/sales': 'Sales',
  '/leads': 'Leads',
  '/expenses': 'Expenses',
  '/meter-readings': 'Meter Readings',
  '/settings': 'Settings',
  '/audit-logs': 'Activity Log',
  '/error-logs': 'Error Logs',
}

function getStoredTheme() {
  try {
    return localStorage.getItem('petrofi-theme') || 'light'
  } catch {
    return 'light'
  }
}

function pumpPageTitle(pathname) {
  if (pathname.match(/^\/pumps\/[^/]+\/information/)) return 'Pump information'
  if (pathname.match(/^\/pumps\/[^/]+\/setup/)) return 'Pump setup'
  if (pathname.startsWith('/pumps/')) return 'Pump data'
  return 'PetroFI'
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isSupportAdmin, setIsSupportAdmin] = useState(false)
  const [accessReady, setAccessReady] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [theme, setTheme] = useState(getStoredTheme)
  const [search, setSearch] = useState('')

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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      setIsSupportAdmin(isSupportAdminEmail(user?.email))
      setUserEmail(user?.email || '')
      setAccessReady(true)
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSupportAdmin(isSupportAdminEmail(session?.user?.email))
      setUserEmail(session?.user?.email || '')
      setAccessReady(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const navItems = useMemo(
    () => ALL_NAV_ITEMS.filter((item) => isSupportAdmin || !item.supportOnly),
    [isSupportAdmin]
  )

  const filteredNav = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return navItems
    return navItems.filter((item) => item.label.toLowerCase().includes(q))
  }, [navItems, search])

  useEffect(() => {
    if (!accessReady || isSupportAdmin) return
    if (SUPPORT_ONLY_PATHS.includes(location.pathname)) {
      navigate('/', { replace: true })
    }
  }, [accessReady, isSupportAdmin, location.pathname, navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const pageTitle = PAGE_TITLES[location.pathname] || pumpPageTitle(location.pathname)

  const NavLinkItem = ({ item }) => {
    const Icon = item.icon
    const isActive =
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
    return (
      <Link
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={`pf-nav-item ${isActive ? 'pf-nav-item-active' : ''}`}
      >
        <Icon className="w-4 h-4 shrink-0 opacity-80" />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="lg:hidden sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="h-14 px-3 flex items-center gap-2">
          <button
            type="button"
            className="pf-btn-ghost !px-2 shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <img
              src="/app_icon.png"
              alt=""
              className="w-7 h-7 object-contain shrink-0"
              width={28}
              height={28}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate leading-tight">PetroFI</p>
              <p className="text-[11px] text-ink-muted truncate leading-tight">{pageTitle}</p>
            </div>
          </div>
          <PasswordResetBell />
          <button
            type="button"
            className="pf-btn-ghost !px-2 shrink-0"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <aside
        className={`fixed inset-y-0 left-0 w-[240px] z-50 flex flex-col border-r border-line bg-surface transform transition-transform duration-200 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-line shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/app_icon.png"
              alt="PetroFI"
              className="w-9 h-9 object-contain shrink-0"
              width={36}
              height={36}
            />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tracking-tight text-ink leading-tight">PetroFI</p>
              <p className="text-[11px] text-ink-muted leading-tight">Admin console</p>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden pf-btn-ghost !px-2 shrink-0"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search navigation"
              className="pf-input !pl-9 !h-8 text-[12px]"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {filteredNav.map((item) => (
            <NavLinkItem key={item.path} item={item} />
          ))}
        </nav>

        <div className="p-3 border-t border-line space-y-2">
          {userEmail && (
            <p className="px-3 text-[11px] text-ink-muted truncate" title={userEmail}>
              {userEmail}
            </p>
          )}
          <button type="button" onClick={handleLogout} className="pf-nav-item w-full">
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:ml-[240px] min-h-screen flex flex-col">
        <header className="hidden lg:flex sticky top-0 z-30 h-14 items-center gap-3 px-8 border-b border-line bg-surface/90 backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold text-ink truncate">{pageTitle}</h1>
          </div>
          <PasswordResetBell />
          <button
            type="button"
            className="pf-btn-ghost !px-2"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="h-8 w-8 rounded-full bg-brand-50 text-brand-700 dark:bg-[rgb(var(--brand-soft))] dark:text-brand-300 text-[12px] font-semibold flex items-center justify-center">
            {(userEmail || 'A').charAt(0).toUpperCase()}
          </div>
        </header>

        <main
          className={`flex-1 w-full mx-auto min-w-0 overflow-x-hidden ${
            location.pathname.startsWith('/pumps/')
              ? 'p-2.5 sm:p-5 lg:p-6 max-w-none'
              : 'p-4 sm:p-6 lg:p-8 max-w-[1440px]'
          }`}
        >
          <Outlet context={{ isSupportAdmin, accessReady, theme, setTheme }} />
        </main>
      </div>
    </div>
  )
}
