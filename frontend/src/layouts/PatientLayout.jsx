import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── nav items ─────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/patient',              label: 'Dashboard',    icon: '🏠', end: true },
  { to: '/patient/appointments', label: 'Appointments', icon: '📅' },
  { to: '/patient/prescriptions',label: 'Rx',           icon: '💊' },
  { to: '/patient/messages',     label: 'Messages',     icon: '💬' },
  { to: '/patient/profile',      label: 'Profile',      icon: '👤' },
]

const ACCENT    = '#1e3a8a'
const ACCENT_BG = 'rgba(30,58,138,0.08)'

// ── helpers ───────────────────────────────────────────────────────────────────

function getUserDisplay(user) {
  if (!user) return { name: 'Patient', initials: 'PT' }
  if (user.first_name && user.last_name) {
    const name = `${user.first_name} ${user.last_name}`
    return { name, initials: `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() }
  }
  const fallback = user.full_name || user.email?.split('@')[0].replace(/[._-]/g, ' ') || 'Patient'
  const name     = fallback.replace(/\b\w/g, c => c.toUpperCase())
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'PT'
  return { name, initials }
}

// ── PatientLayout ─────────────────────────────────────────────────────────────

export default function PatientLayout() {
  const navigate         = useNavigate()
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
            <div className="text-xs font-medium" style={{ color: 'var(--primary)' }}>Patient Portal</div>
          </div>
        </div>

        {/* nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all no-underline"
              style={({ isActive }) => ({
                background: isActive ? ACCENT_BG         : 'transparent',
                color:      isActive ? 'var(--primary)'  : 'var(--text)',
                fontWeight: isActive ? '600'             : '500',
              })}>
              <span>{icon}</span>
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
              <div className="text-xs font-medium capitalize" style={{ color: 'var(--primary)' }}>
                {user?.role ?? 'patient'}
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
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white flex-shrink-0"
              style={{ background: ACCENT }}>
              PATIENT
            </span>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>
              {name}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-red-50 hover:border-red-200"
            style={{ borderColor: 'var(--border)', color: '#dc2626' }}>
            <LogoutIcon size={13} />
            <span>Log out</span>
          </button>
        </header>

        {/* page content */}
        <main className="flex-1 overflow-y-auto p-6 pb-24 lg:pb-6">
          <div className="max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* ── mobile bottom nav ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t flex bg-white"
          style={{ borderColor: 'var(--border)', zIndex: 50 }}>
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 no-underline"
              style={({ isActive }) => ({ color: isActive ? 'var(--primary)' : 'var(--text)' })}>
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          ))}
          {/* logout tab on mobile */}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5"
            style={{ color: '#dc2626', background: 'transparent', border: 'none' }}>
            <LogoutIcon size={20} />
            <span className="text-xs font-medium">Log out</span>
          </button>
        </nav>
      </div>
    </div>
  )
}

// ── icons ─────────────────────────────────────────────────────────────────────

function LogoutIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
