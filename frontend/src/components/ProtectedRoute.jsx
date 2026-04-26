import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Maps every known role to its home dashboard.
// Used to redirect wrong-role users to the right place instead of a dead-end.
const ROLE_HOME = {
  admin:   '/admin',
  doctor:  '/doctor',
  patient: '/patient',
}

// ─── full-page loading screen ─────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: '#f8fafc' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--primary)' }}>
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"
            fill="none" stroke="white" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Loading…
        </span>
      </div>
    </div>
  )
}

// ─── ProtectedRoute ────────────────────────────────────────────────────────────
//
// Usage (React Router v6 layout-route pattern):
//
//   <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
//     <Route path="/admin" element={<AdminLayout />}>…</Route>
//   </Route>
//
// Props:
//   allowedRoles  string[]  – omit to allow any authenticated user
//
// Redirect behaviour:
//   • Not logged in          → /login  (preserves the attempted URL in state)
//   • Logged in, wrong role  → ROLE_HOME[user.role]  (their own dashboard)
//   • Logged in, right role  → renders <Outlet />

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  // Hold render until localStorage rehydration finishes
  if (loading) return <LoadingScreen />

  // Not authenticated → preserve the attempted URL so Login can redirect back
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Authenticated but wrong role → send to their own dashboard, not a dead-end
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const home = ROLE_HOME[user.role] ?? '/'
    return <Navigate to={home} replace />
  }

  return <Outlet />
}
