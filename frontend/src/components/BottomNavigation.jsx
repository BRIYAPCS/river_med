import { NavLink } from 'react-router-dom'

const items = [
  { to: '/dashboard',     label: 'Home',    icon: '🏠' },
  { to: '/appointments',  label: 'Visits',  icon: '📅' },
  { to: '/prescriptions', label: 'Rx',      icon: '💊' },
  { to: '/messages',      label: 'Messages',icon: '💬' },
  { to: '/profile',       label: 'Profile', icon: '👤' },
]

export default function BottomNavigation() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t flex"
      style={{ borderColor: 'var(--border)', background: 'var(--bg)', zIndex: 50 }}>
      {items.map(({ to, label, icon }) => (
        <NavLink key={to} to={to}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 no-underline transition-colors"
          style={({ isActive }) => ({
            color: isActive ? 'var(--primary)' : 'var(--text)',
          })}>
          <span className="text-xl leading-none">{icon}</span>
          <span className="text-xs font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
