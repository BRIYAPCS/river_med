import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard',     label: 'Dashboard',     icon: HomeIcon },
  { to: '/appointments',  label: 'Appointments',  icon: CalendarIcon },
  { to: '/prescriptions', label: 'Prescriptions', icon: PillIcon },
  { to: '/messages',      label: 'Messages',      icon: ChatIcon },
  { to: '/profile',       label: 'Profile',       icon: UserIcon },
]

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r py-6 px-3"
      style={{ borderColor: 'var(--border)', background: 'var(--bg)', minHeight: '100%' }}>
      <nav className="flex flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all no-underline"
            style={({ isActive }) => ({
              background: isActive ? 'var(--primary-bg)' : 'transparent',
              color:      isActive ? 'var(--primary)'    : 'var(--text)',
              fontWeight: isActive ? '600'               : '500',
            })}>
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-4 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white"
            style={{ background: 'var(--primary)' }}>
            AJ
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>Alex Johnson</div>
            <div className="text-xs" style={{ color: 'var(--text)' }}>Patient</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function PillIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.5 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7.5"/>
      <path d="M16 19h6"/><path d="M19 16v6"/>
    </svg>
  )
}
