import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { RequireUser } from '../components/RequireUser'
import { HiOutlineBellAlert, HiOutlineCheckBadge, HiOutlineEnvelopeOpen } from 'react-icons/hi2'

export function NotificationsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)

  const load = async () => {
    const [{ data: n }, { data: c }] = await Promise.all([
      api.get('/api/notifications'),
      api.get('/api/notifications/unread-count'),
    ])
    setItems(n)
    setCount(c.count)
  }

  useEffect(() => {
    if (user) void load().catch(() => {})
  }, [user])

  const mark = async (id) => {
    await api.patch(`/api/notifications/${id}/read`)
    await load()
  }

  const markAll = async () => {
    await api.post('/api/notifications/read-all')
    await load()
  }

  return (
    <RequireUser>
    <div>
      <section className="hero-card rainbow mb-6">
        <div className="hero-grid">
          <div className="relative z-10">
            <p className="glass-chip">Live Updates</p>
            <h1 className="mt-3 flex items-center gap-2">
              <HiOutlineBellAlert className="text-cyan-300" />
              <span className="gradient-title">Stay Informed Instantly</span>
            </h1>
            <p className="small max-w-2xl">
              Keep track of approvals, ticket updates, and comment activity in one bright,
              easy-to-scan notification feed.
            </p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1100&q=80"
            alt="Notification and communication concept"
            className="feature-image"
          />
        </div>
      </section>

      <h1 className="flex items-center gap-2">
        <HiOutlineBellAlert className="text-cyan-300" />
        Notifications
      </h1>
      <div className="card-grid">
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineBellAlert className="text-amber-300" /> Unread</p>
          <p className="text-3xl font-bold metric-value">{count}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineCheckBadge className="text-emerald-300" /> Read</p>
          <p className="text-3xl font-bold metric-value">{items.length - count}</p>
        </div>
        <div className="card">
          <p className="small flex items-center gap-2"><HiOutlineEnvelopeOpen className="text-violet-300" /> Total</p>
          <p className="text-3xl font-bold metric-value">{items.length}</p>
        </div>
      </div>
      <button type="button" className="btn ghost" onClick={() => void markAll()}>
        Mark all read
      </button>
      {items.map((n) => (
        <div key={n.id} className="card" style={{ opacity: n.read ? 0.65 : 1 }}>
          <span className="tag">{n.type}</span>
          {!n.read && <span className="tag warn">New</span>}
          <h2 style={{ marginTop: '0.5rem', color: 'var(--sc-navy-900)' }}>{n.title}</h2>
          <p className="small">{new Date(n.createdAt).toLocaleString()}</p>
          <p>{n.message}</p>
          {!n.read && (
            <button type="button" className="btn ghost" onClick={() => void mark(n.id)}>
              Mark read
            </button>
          )}
        </div>
      ))}
    </div>
    </RequireUser>
  )
}
