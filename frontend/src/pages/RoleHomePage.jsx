import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../auth/roleRouting'
import { CataloguePage } from './CataloguePage'

export function RoleHomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }

  if (!user) {
    return <CataloguePage />
  }

  return <Navigate to={getDashboardPath(user.role)} replace />
}
