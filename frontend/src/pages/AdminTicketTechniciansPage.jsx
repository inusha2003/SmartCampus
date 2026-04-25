import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, fetchCsrf } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AdminTicketsSubnav } from '../components/AdminTicketsSubnav'
import { HiOutlineUserGroup } from 'react-icons/hi2'

export function AdminTicketTechniciansPage() {
  const TECH_CATEGORIES = ['IT Support', 'Maintenance', 'Electrical Issues', 'Cleaning and Waste', 'Fire']
  const { user, loading: authLoading } = useAuth()
  const [staff, setStaff] = useState([])
  const [tickets, setTickets] = useState([])
  const [search, setSearch] = useState('')
  const [specialization, setSpecialization] = useState('ALL')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newCategory, setNewCategory] = useState('IT Support')
  const [newPhone, setNewPhone] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState(null)

  const load = async () => {
    const [{ data: staffData }, { data: ticketData }] = await Promise.all([
      api.get('/api/admin/users-staff'),
      api.get('/api/tickets'),
    ])
    setStaff(Array.isArray(staffData) ? staffData : [])
    setTickets(Array.isArray(ticketData) ? ticketData : [])
  }

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    void load().catch(() => setErr('Failed to load technician data.'))
  }, [user])

  const techUsers = useMemo(
    () => staff.filter((u) => String(u.role || '').toUpperCase() === 'TECHNICIAN'),
    [staff],
  )

  const techRows = useMemo(() => {
    const counts = new Map()
    for (const t of tickets) {
      if (t.assignedToId == null) continue
      counts.set(t.assignedToId, (counts.get(t.assignedToId) || 0) + 1)
    }
    const q = search.trim().toLowerCase()
    return techUsers
      .map((t) => {
        const tags = String(t.displayName || '').toLowerCase()
        const email = String(t.email || '').toLowerCase()
        const matchesSearch = !q || tags.includes(q) || email.includes(q)
        const spec = specialization.toUpperCase()
        const text = `${tags} ${email}`
        const matchesSpec =
          spec === 'ALL' ||
          (spec === 'IT' && /it|support|network|system/.test(text)) ||
          (spec === 'MAINTENANCE' && /maint|facility|repair|ac|plumb/.test(text)) ||
          (spec === 'ELECTRICAL' && /electric|power|wiring|circuit/.test(text))
        return {
          ...t,
          activeTasks: counts.get(t.id) || 0,
          visible: matchesSearch && matchesSpec,
        }
      })
      .filter((x) => x.visible)
      .sort((a, b) => b.activeTasks - a.activeTasks || String(a.displayName).localeCompare(String(b.displayName)))
  }, [techUsers, tickets, search, specialization])

  const addTechnician = async (e) => {
    e.preventDefault()
    setErr(null)
    const displayName = newName.trim()
    const email = newEmail.trim()
    const phone = newPhone.replace(/\D/g, '')
    if (!displayName || !email || !newCategory || phone.length !== 10) {
      setErr('Name, email, category, and a 10-digit phone number are required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('Enter a valid email address.')
      return
    }
    // Backend user creation still requires a password; derive a deterministic starter password.
    const password = `Tech#${phone.slice(-6)}`
    const displayNameWithCategory = `${displayName} [${newCategory}]`
    setAdding(true)
    const attempts = [
      () => api.post('/api/admin/users', { email, displayName: displayNameWithCategory, password, role: 'TECHNICIAN' }),
      () => api.post('/api/admin/users', { email, name: displayNameWithCategory, password, role: 'TECHNICIAN' }),
      () => api.post('/api/auth/register', { email, displayName: displayNameWithCategory, password, role: 'TECHNICIAN' }),
    ]
    let ok = false
    for (const attempt of attempts) {
      try {
        await fetchCsrf()
        await attempt()
        ok = true
        break
      } catch {
        // fallback to next endpoint
      }
    }
    if (!ok) {
      setErr('Could not add technician.')
      setAdding(false)
      return
    }
    setNewName('')
    setNewEmail('')
    setNewCategory('IT Support')
    setNewPhone('')
    await load()
    setAdding(false)
  }

  if (authLoading) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="small">Checking your session…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />

  const totalActive = techRows.reduce((sum, t) => sum + t.activeTasks, 0)
  const busiest = techRows[0]

  return (
    <div className="admin-ticket-tech-page">
      <AdminTicketsSubnav />

      <section className="admin-ticket-tech-hero">
        <div>
          <p className="glass-chip">Technician management</p>
          <h1 className="admin-ticket-tech-title">
            <HiOutlineUserGroup className="text-cyan-300" aria-hidden />
            Technician management
          </h1>
          <p className="small max-w-3xl">
            Add support technicians and keep assignment visibility next to your admin ticket desk.
          </p>
        </div>
        <form className="admin-ticket-tech-add" onSubmit={(e) => void addTechnician(e)}>
          <h2>Add technician</h2>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            autoComplete="name"
          />
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            inputMode="email"
            type="email"
          />
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} aria-label="Select category">
            {TECH_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Phone number"
            autoComplete="tel"
            inputMode="numeric"
          />
          <button className="btn primary" type="submit" disabled={adding}>
            {adding ? 'Adding…' : 'Add technician'}
          </button>
        </form>
      </section>

      <section className="admin-ticket-tech-controls">
        <div className="card-grid">
          <div className="card">
            <p className="small">Crew strength</p>
            <p className="text-3xl font-bold metric-value">{techUsers.length}</p>
          </div>
          <div className="card">
            <p className="small">Live workload</p>
            <p className="text-3xl font-bold metric-value">{totalActive}</p>
          </div>
          <div className="card">
            <p className="small">Busiest tech</p>
            <p className="text-3xl font-bold metric-value">{busiest?.displayName || '—'}</p>
          </div>
        </div>
        <div className="admin-ticket-tech-filters">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search technicians"
          />
          <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
            <option value="ALL">Specialization: All</option>
            <option value="IT">IT Support</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="ELECTRICAL">Electrical</option>
          </select>
        </div>
      </section>

      <section className="admin-ticket-tech-list">
        {techRows.length === 0 ? (
          <div className="card">
            <p className="small">No technicians match your filter.</p>
          </div>
        ) : (
          techRows.map((t) => (
            <article className="card admin-ticket-tech-card" key={t.id}>
              <div>
                <h3>{t.displayName}</h3>
                <p className="small">{t.email}</p>
              </div>
              <div className="admin-ticket-tech-card-stats">
                <span className="tag">{t.role}</span>
                <span className="tag warn">{t.activeTasks} active tasks</span>
              </div>
            </article>
          ))
        )}
      </section>

      {err ? <p className="error">{err}</p> : null}
    </div>
  )
}
