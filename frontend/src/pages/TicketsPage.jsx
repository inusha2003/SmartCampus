import { useAuth } from '../auth/AuthContext'
import { RequireUser } from '../components/RequireUser'
import { ReporterTicketsPage } from './ReporterTicketsPage'
import { TechnicianTasksPage } from './TechnicianTasksPage'

export function TicketsPage() {
  const { user, loading } = useAuth()

  return (
    <RequireUser>
      {loading ? (
        <div className="card" style={{ maxWidth: 480 }}>
          <p className="small">Loading…</p>
        </div>
      ) : user?.role === 'TECHNICIAN' ? (
        <TechnicianTasksPage />
      ) : (
        <ReporterTicketsPage />
      )}
    </RequireUser>
  )
}
