import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const TOKEN_KEY = 'river_med_token'
const USER_KEY  = 'river_med_user'

const AuthContext = createContext(null)

// ─── provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(null)
  const [loading, setLoading] = useState(true)   // true while reading localStorage

  // rehydrate from localStorage on first render
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser  = localStorage.getItem(USER_KEY)
      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      }
    } catch {
      // corrupted storage — clear it
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

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
