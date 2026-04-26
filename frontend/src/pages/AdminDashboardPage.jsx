import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../auth/roleRouting'

export function AdminDashboardPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to={getDashboardPath(user.role)} replace />

  return (
    <div>
      <h1>Admin dashboard</h1>
      <p className="small">Manage resources, approvals, and campus-wide operations.</p>
      <div className="card-grid">
        <div className="card">
          <h2>Booking approvals</h2>
          <p className="small">Review and decide pending booking requests.</p>
          <Link to="/admin/bookings" className="btn primary">
            Open booking queue
          </Link>
        </div>
        <div className="card">
          <h2>Resource management</h2>
          <p className="small">Create, edit, and retire campus resources.</p>
          <Link to="/admin/resources" className="btn primary">
            Open resources
          </Link>
        </div>
      </div>
    </div>
  )
}
