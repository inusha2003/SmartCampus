import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { HiOutlineClipboardDocumentList, HiOutlineClock, HiOutlineXCircle } from 'react-icons/hi2'

export function AdminBookingsPage() {
  const MAX_REASON = 500
  const { user, loading: authLoading } = useAuth()
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('PENDING')
  const [err, setErr] = useState(null)

  const load = async () => {
    const params = filter ? { status: filter } : {}
    const { data } = await api.get('/api/bookings', { params })
    setBookings(data)
  }

  useEffect(() => {
    if (user?.role === 'ADMIN') void load().catch(() => setErr('Failed to load'))
  }, [user, filter])

  if (authLoading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />

  const decide = async (id, approve) => {
    const inputReason = approve
      ? window.prompt('Optional note for approval:', '') || ''
      : window.prompt('Reason for rejection (required):', '') || ''
    const reason = inputReason.trim()
    if (!approve && !reason) {
      setErr('Rejection needs a reason')
      return
    }
    if (reason.length > MAX_REASON) {
      setErr(`Decision reason must be at most ${MAX_REASON} characters.`)
      return
    }
    setErr(null)
    try {
      await api.put(`/api/bookings/${id}/decision`, { approve, reason: reason || null })
      await load()
    } catch {
      setErr('Decision failed')
    }
  }

  return (
    <div>
      <section className="hero-card rainbow mb-6">
        <div className="hero-grid">
          <div className="relative z-10">
            <p className="glass-chip">Approval Desk</p>
            <h1 className="mt-3 flex items-center gap-2">
              <HiOutlineClipboardDocumentList className="text-cyan-300" />
              <span className="gradient-title">Review Booking Requests Fast</span>
            </h1>
            <p className="small max-w-2xl">
              Process booking requests with a clean queue, clear status indicators, and quick
              approve/reject actions.
            </p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1100&q=80"
            alt="Team reviewing schedule"
            className="feature-image"
          />
        </div>
      </section>

      <h1 className="flex items-center gap-2">
        <HiOutlineClipboardDocumentList className="text-cyan-300" />
        Admin — booking queue
      </h1>
      <div className="card-grid">
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineClock className="text-amber-300" /> Pending</p>
          <p className="text-3xl font-bold metric-value">{bookings.filter((x) => x.status === 'PENDING').length}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineXCircle className="text-rose-300" /> Rejected</p>
          <p className="text-3xl font-bold metric-value">{bookings.filter((x) => x.status === 'REJECTED').length}</p>
        </div>
      </div>
      <div className="field">
        <label>Status filter</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>
      {err && <p className="error">{err}</p>}
      {bookings.map((b) => (
        <div key={b.id} className="card">
          <span className="tag">{b.status}</span>
          <h2 style={{ marginTop: '0.5rem', color: 'var(--sc-navy-900)' }}>{b.resourceName}</h2>
          <p className="small">Requester: {b.requesterEmail}</p>
          <p className="small">
            {new Date(b.startAt).toLocaleString()} — {new Date(b.endAt).toLocaleString()}
          </p>
          {b.purpose && <p className="small">{b.purpose}</p>}
          {b.status === 'PENDING' && (
            <div className="row-actions">
              <button type="button" className="btn primary" onClick={() => void decide(b.id, true)}>
                Approve
              </button>
              <button type="button" className="btn danger" onClick={() => void decide(b.id, false)}>
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
