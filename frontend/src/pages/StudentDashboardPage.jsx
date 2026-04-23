import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../auth/roleRouting'

export function StudentDashboardPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'USER') return <Navigate to={getDashboardPath(user.role)} replace />

  return (
    <div>
      <h1>Student dashboard</h1>
      <p className="small">Book spaces, manage your requests, and report campus issues.</p>
      <div className="card-grid">
        <div className="card">
          <h2>Find resources</h2>
          <p className="small">Browse rooms, labs, and equipment.</p>
          <Link to="/catalogue" className="btn primary">
            Open catalogue
          </Link>
        </div>
        <div className="card">
          <h2>My bookings</h2>
          <p className="small">Track pending, approved, and rejected bookings.</p>
          <Link to="/bookings" className="btn primary">
            Open bookings
          </Link>
        </div>
        <div className="card">
          <h2>Support tickets</h2>
          <p className="small">Create and monitor maintenance or incident tickets.</p>
          <Link to="/tickets" className="btn primary">
            Open tickets
          </Link>
        </div>
      </div>
    </div>
  )
}
