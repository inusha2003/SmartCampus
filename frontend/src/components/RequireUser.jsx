import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/**
 * Waits until the initial session check finishes before treating "no user" as logged out.
 * Without this, protected routes redirect to /login while user is still null during loading.
 */
export function RequireUser({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return children
}
