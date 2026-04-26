import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_HOME = { admin: '/admin', doctor: '/doctor', patient: '/patient' }

const ROLES = [
  {
    path:    '/admin',
    label:   'Admin',
    sub:     'Front Desk',
    icon:    '🖥️',
    color:   '#6366f1',
    bg:      'rgba(99,102,241,0.08)',
    desc:    'Manage check-ins, queue, and patient records.',
  },
  {
    path:    '/doctor',
    label:   'Doctor',
    sub:     'Physician',
    icon:    '🩺',
    color:   '#0d9488',
    bg:      'rgba(13,148,136,0.08)',
    desc:    'View patient records and write prescriptions.',
  },
  {
    path:    '/patient',
    label:   'Patient',
    sub:     'Portal',
    icon:    '🏥',
    color:   '#1e3a8a',
    bg:      'rgba(30,58,138,0.08)',
    desc:    'Appointments, medications, and messages.',
  },
]

export default function LandingPage() {
  const navigate             = useNavigate()
  const { isAuthenticated, user } = useAuth()

  function goToPortal() {
    if (isAuthenticated && user) {
      navigate(ROLE_HOME[user.role] ?? '/dashboard')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top Bar */}
      <header className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary)' }}>
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="font-bold text-lg" style={{ color: 'var(--text-h)' }}>River Med</span>
        </div>
        <button className="button-primary text-sm" onClick={goToPortal}>
          {isAuthenticated ? 'Go to Dashboard' : 'Sign In'}
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
          style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
          Your Health, Simplified
        </div>

        <h1 className="max-w-2xl mb-6" style={{ color: 'var(--text-h)' }}>
          Modern Healthcare<br />at Your Fingertips
        </h1>

        <p className="text-lg max-w-lg mb-10" style={{ color: 'var(--text)' }}>
          Manage appointments, prescriptions, and messages with your care team — all in one place.
        </p>

        {/* Role Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 mb-6 max-w-2xl w-full">
          {ROLES.map(r => (
            <button key={r.path}
              onClick={() => isAuthenticated && user?.role === r.path.slice(1)
                ? navigate(r.path)
                : navigate('/login')}
              className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 text-center transition-all hover:scale-105"
              style={{ borderColor: r.color, background: r.bg }}>
              <span className="text-3xl">{r.icon}</span>
              <div>
                <div className="font-bold text-sm" style={{ color: r.color }}>{r.label}</div>
                <div className="text-xs" style={{ color: 'var(--text)' }}>{r.sub}</div>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>{r.desc}</p>
            </button>
          ))}
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl w-full text-left">
          {[
            { icon: '📅', title: 'Appointments', desc: 'Book and manage visits with your care team instantly.' },
            { icon: '💊', title: 'Prescriptions', desc: 'View medications and request refills without a call.' },
            { icon: '💬', title: 'Secure Messaging', desc: 'Communicate directly with your doctor anytime.' },
          ].map((f) => (
            <div key={f.title} className="card">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-h)' }}>{f.title}</h3>
              <p className="text-sm" style={{ color: 'var(--text)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-6 text-center text-sm" style={{ color: 'var(--text)', borderTop: '1px solid var(--border)' }}>
        © {new Date().getFullYear()} River Med. All rights reserved.
      </footer>
    </div>
  )
}
