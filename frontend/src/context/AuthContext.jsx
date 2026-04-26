import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authMe } from '../services/api'

const TOKEN_KEY = 'river_med_token'
const USER_KEY  = 'river_med_user'

// Role → home dashboard mapping. Shared with ProtectedRoute and Login.
export const ROLE_HOME = {
  admin:   '/admin',
  doctor:  '/doctor',
  patient: '/patient',
}

const AuthContext = createContext(null)

// ─── provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(null)
  // loading stays true until the initial auth check resolves.
  // ProtectedRoute shows a spinner during this time so nothing flashes.
  const [loading, setLoading] = useState(true)

  // ── initial auth check ────────────────────────────────────────────────────
  // On every page load:
  //   1. Read token from localStorage.
  //   2. If no token → not logged in, done.
  //   3. If token found → call GET /auth/me to verify it is still valid and
  //      get fresh user data (name, role, patient_id, etc.).
  //   4. Success → set state + refresh cached user in localStorage.
  //   5. Failure → token is expired/revoked → clear storage → force login.
  //
  // api.js reads the token from localStorage directly, so the /auth/me call
  // automatically includes the Authorization header without needing setState first.
  useEffect(() => {
    async function init() {
      const storedToken = localStorage.getItem(TOKEN_KEY)

      if (!storedToken) {
        setLoading(false)
        return
      }

      try {
        const { user: freshUser } = await authMe()
        // Persist refreshed user data — role or name may have changed server-side
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser))
        setToken(storedToken)
        setUser(freshUser)
      } catch {
        // Token invalid or server unreachable — drop the stale session
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  // ── 401 auto-logout ───────────────────────────────────────────────────────
  // api.js fires this event whenever any request returns 401 so that
  // expired tokens are cleared without a circular import.
  useEffect(() => {
    function handleExpired() {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setToken(null)
      setUser(null)
    }
    window.addEventListener('auth:expired', handleExpired)
    return () => window.removeEventListener('auth:expired', handleExpired)
  }, [])

  // ── login ─────────────────────────────────────────────────────────────────
  // Called by Login.jsx after a successful /auth/login or /auth/verify-otp.
  // The caller is responsible for navigating to ROLE_HOME[user.role].
  const login = useCallback((newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

  // ── logout ────────────────────────────────────────────────────────────────
  // Clears all auth state. Caller navigates to /login.
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
