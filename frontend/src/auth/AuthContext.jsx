import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, fetchCsrf, resetCsrf } from '../api/client'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshInFlight = useRef(null)

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) {
      return refreshInFlight.current
    }
    const run = (async () => {
      try {
        const { data } = await api.get('/api/auth/me')
        setUser(data)
        try {
          await fetchCsrf()
        } catch {
          /* ignore csrf refresh errors here */
        }
        return data
      } catch {
        setUser(null)
        return null
      } finally {
        setLoading(false)
        refreshInFlight.current = null
      }
    })()
    refreshInFlight.current = run
    return run
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
      return
    }
    void refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      /* ignore */
    }
    resetCsrf()
    setUser(null)
    window.location.href = '/'
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
