import { useNavigate } from 'react-router-dom'
import { useAuth }     from '../../context/AuthContext'

const ROLE_HOME = { admin: '/admin', doctor: '/doctor', patient: '/patient' }

export default function Unauthorized() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#f8fafc' }}>
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-h)' }}>
          Access Denied
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text)' }}>
          You don't have permission to view this page.
          {user && ` Your role is "${user.role}".`}
        </p>
        <div className="flex gap-3 justify-center">
          {user && (
            <button
              onClick={() => navigate(ROLE_HOME[user.role] ?? '/')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--primary)' }}>
              Go to my dashboard
            </button>
          )}
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
