import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from '../components/NotificationBell'

// ── nav items ─────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/admin',              label: 'Dashboard',    icon: GridIcon,      end: true },
  { to: '/admin/queue',        label: 'Queue',        icon: ListIcon },
  { to: '/admin/refills',      label: 'Refill Reqs',  icon: RefillIcon },
  { to: '/admin/patients',     label: 'Patients',     icon: UsersIcon },
  { to: '/admin/appointments', label: 'Appointments', icon: CalendarIcon },
  { to: '/admin/billing',      label: 'Billing',      icon: BillingIcon },
  { to: '/admin/analytics',    label: 'Analytics',    icon: AnalyticsIcon },
  { to: '/admin/reports',      label: 'Reports',      icon: ReportsIcon },
  { to: '/admin/audit',        label: 'Audit Log',    icon: AuditIcon },
]

const ACCENT    = '#6366f1'
const ACCENT_BG = 'rgba(99,102,241,0.10)'

// ── helpers ───────────────────────────────────────────────────────────────────

function getUserDisplay(user) {
  if (!user) return { name: 'Admin', initials: 'AD' }
  if (user.first_name && user.last_name) {
    const name = `${user.first_name} ${user.last_name}`
    return { name, initials: `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() }
  }
  const fallback = user.full_name || user.email?.split('@')[0].replace(/[._-]/g, ' ') || 'Admin'
  const name     = fallback.replace(/\b\w/g, c => c.toUpperCase())
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'AD'
  return { name, initials }
}

// ── AdminLayout ───────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const navigate        = useNavigate()
  const { user, logout } = useAuth()
  const { name, initials } = getUserDisplay(user)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex" style={{ minHeight: '100svh', background: '#f8fafc' }}>

      {/* ── sidebar (desktop) ── */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r"
        style={{ background: '#fff', borderColor: 'var(--border)' }}>

        {/* logo */}
        <div className="flex items-center gap-2 px-5 py-5 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: ACCENT }}>
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--text-h)' }}>River Med</div>
            <div className="text-xs font-medium" style={{ color: ACCENT }}>Admin Portal</div>
          </div>
        </div>

        {/* nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all no-underline"
              style={({ isActive }) => ({
                background: isActive ? ACCENT_BG : 'transparent',
                color:      isActive ? ACCENT     : 'var(--text)',
                fontWeight: isActive ? '600'      : '500',
              })}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* user identity + logout */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm text-white"
              style={{ background: ACCENT }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>
                {name}
              </div>
              <div className="text-xs font-medium capitalize" style={{ color: ACCENT }}>
                {user?.role ?? 'admin'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-red-50"
            style={{ color: '#dc2626' }}>
            <LogoutIcon />
            Log out
          </button>
        </div>
      </aside>

      {/* ── main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* top header */}
        <header className="flex items-center justify-between px-6 py-4 border-b bg-white"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
              style={{ background: ACCENT }}>
              ADMIN
            </span>
            <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--text)' }}>
              Front Desk Management
            </span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell accentColor={ACCENT} />
            <span className="text-sm font-semibold truncate max-w-40"
              style={{ color: 'var(--text-h)' }}>
              {name}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-red-50 hover:border-red-200"
              style={{ borderColor: 'var(--border)', color: '#dc2626' }}>
              <LogoutIcon size={13} />
              <span>Log out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

// ── icons ─────────────────────────────────────────────────────────────────────

function GridIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}
function ListIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function RefillIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}
function AnalyticsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  )
}
function BillingIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  )
}
function ReportsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}
function AuditIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )
}
function LogoutIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
