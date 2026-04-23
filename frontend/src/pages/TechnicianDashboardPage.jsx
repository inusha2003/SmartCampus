import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../auth/roleRouting'

export function TechnicianDashboardPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'TECHNICIAN') return <Navigate to={getDashboardPath(user.role)} replace />

  return (
    <div>
      <h1>Technician dashboard</h1>
      <p className="small">Handle maintenance queue, update progress, and close incidents.</p>
      <div className="card-grid">
        <div className="card">
          <h2>Ticket queue</h2>
          <p className="small">Review assigned and open tickets that need action.</p>
          <Link to="/tickets" className="btn primary">
            Open ticket queue
          </Link>
        </div>
        <div className="card">
          <h2>Notifications</h2>
          <p className="small">Check latest activity and updates from users/admin.</p>
          <Link to="/notifications" className="btn primary">
            Open notifications
          </Link>
        </div>
      </div>
    </div>
  )
}
